const clampProgress = value => Math.max(0, Math.min(1, value));
const interpolate = (start, end, fraction) => start + (end - start) * fraction;

export function buildJourneyPath(width, height) {
  const stops = [[0, 0], [0, height], [width, height], [width, 2 * height], [0, 2 * height]];
  const points = [];
  const stopIndices = [];
  let length = 0;

  const addPoint = (x, y) => {
    const previous = points[points.length - 1];
    if (previous) length += Math.hypot(x - previous.x, y - previous.y);
    points.push({ x, y, length });
  };

  stops.forEach(([x, y], index) => {
    if (index === 0 || index === stops.length - 1) {
      stopIndices.push(points.length);
      addPoint(x, y);
      return;
    }

    const [beforeX, beforeY] = stops[index - 1];
    const [nextX, nextY] = stops[index + 1];
    const trim = .13 * Math.min(width, height);
    const incoming = trim / Math.hypot(beforeX - x, beforeY - y);
    const outgoing = trim / Math.hypot(nextX - x, nextY - y);
    const entryX = interpolate(x, beforeX, incoming);
    const entryY = interpolate(y, beforeY, incoming);
    const exitX = interpolate(x, nextX, outgoing);
    const exitY = interpolate(y, nextY, outgoing);
    stopIndices.push(points.length + 2);

    for (let step = 0; step <= 4; step++) {
      const t = step / 4;
      addPoint(
        interpolate(interpolate(entryX, x, t), interpolate(x, exitX, t), t),
        interpolate(interpolate(entryY, y, t), interpolate(y, exitY, t), t),
      );
    }
  });

  return {
    length,
    stops,
    checkpoints: stopIndices.map(index => points[index].length / length),
    at(progress) {
      const distance = clampProgress(progress) * length;
      const index = points.findIndex(point => point.length >= distance);
      if (index === 0) return stops[0];
      const { x, y, length: start } = points[index - 1];
      const next = points[index];
      const fraction = (distance - start) / (next.length - start);
      return [interpolate(x, next.x, fraction), interpolate(y, next.y, fraction)];
    },
  };
}

let activeJourney;

export function supportsReelLayout() {
  return CSS.supports('height', '100svh') && CSS.supports('selector(:has(*))');
}

export function goToJourneyTarget(target, behavior, { center = false } = {}) {
  return activeJourney?.goTo(target, behavior, center) ?? false;
}

function mountJourney(runway, viewport, canvas, scenes) {
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const passive = { passive: true, signal };
  let path;
  let start;
  let travel;
  let width = 0;
  let height = 0;
  let frame = 0;
  let time = 0;
  let displayed = 0;
  let visible = true;
  let destination;
  let sceneIndex = 0;
  let pose = '';

  const sceneFor = target => target === runway ? 0 : scenes.indexOf(target?.closest('[data-journey-scene]'));
  const hashTarget = hash => document.getElementById(hash.slice(1));
  const scrollTarget = () => clampProgress((scrollY - start) / travel);

  function render() {
    let [x, y] = path.at(displayed);
    // A direct link lands square on the scene even where the scroll path cuts a corner.
    if (destination && Math.abs(scrollY - destination.top) < 2) {
      const stop = path.checkpoints[destination.index];
      const blend = clampProgress(1 - Math.abs(displayed - stop) / .02);
      const [stopX, stopY] = path.stops[destination.index];
      x = interpolate(x, stopX, blend);
      y = interpolate(y, stopY, blend);
      destination.arrived = true;
    } else if (destination?.arrived) {
      destination = undefined;
    }

    const transform = `translate3d(${-x}px, ${-y}px, 0)`;
    if (transform !== pose) {
      canvas.style.transform = transform;
      pose = transform;
    }

    const next = path.checkpoints.findIndex((checkpoint, index) => index > 0 &&
      displayed < (path.checkpoints[index - 1] + checkpoint) / 2);
    sceneIndex = next < 0 ? scenes.length - 1 : next - 1;
    const current = scenes[sceneIndex].id || runway.id;
    if (runway.dataset.journeyCurrent !== current) {
      runway.dataset.journeyCurrent = current;
      runway.dispatchEvent(new Event('journey:scenechange', { bubbles: true }));
    }
  }

  function tick(now) {
    frame = 0;
    const target = scrollTarget();
    displayed += (target - displayed) * (1 - Math.exp(-Math.max(1, now - time) / 160));
    if (Math.abs(displayed - target) < .00001) displayed = target;
    time = now;
    render();
    if (displayed !== target) frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function schedule() {
    if (frame || !visible || document.hidden) return;
    time = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function measure() {
    const { clientWidth, clientHeight } = viewport;
    if (!clientWidth || !clientHeight || (width === clientWidth && height === clientHeight)) return;
    const inRunway = path && scrollY >= start && scrollY <= start + travel + 1;
    const progress = inRunway ? scrollTarget() : 0;
    width = clientWidth;
    height = clientHeight;
    path = buildJourneyPath(width, height);
    start = runway.getBoundingClientRect().top + scrollY;
    travel = Math.max(1, runway.offsetHeight - height);
    if (destination) {
      destination.top = start + path.checkpoints[destination.index] * travel;
    }
    if (destination?.arrived && inRunway) {
      window.scrollTo({ top: destination.top, behavior: 'instant' });
      displayed = scrollTarget();
    } else if (inRunway) {
      window.scrollTo({ top: start + progress * travel, behavior: 'instant' });
    }
    render();
    schedule();
  }

  function goTo(target, behavior, center) {
    const index = sceneFor(target);
    if (index < 0 || !path) return false;

    const scene = scenes[index];
    const bounds = scene.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    let top = 0;
    if (target !== scene && target !== runway) {
      top = scene.scrollTop + rect.top - bounds.top;
      if (center) top -= Math.max(0, (scene.clientHeight - rect.height) / 2);
    }
    scene.scrollTo({ top, behavior });

    destination = { index, top: start + path.checkpoints[index] * travel };
    window.scrollTo({ top: destination.top, behavior });
    if (behavior === 'instant') {
      displayed = scrollTarget();
      render();
    }
    schedule();
    return true;
  }

  function syncHash() {
    const target = hashTarget(location.hash);
    if (!target || target.classList.contains('project')) return;
    goTo(target, 'instant');
  }

  runway.setAttribute('data-journey', '');
  measure();
  displayed = scrollTarget();
  render();
  syncHash();

  const dimensions = new ResizeObserver(measure);
  dimensions.observe(viewport);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) schedule();
    else stop();
  });
  intersection.observe(viewport);

  window.addEventListener('scroll', schedule, passive);
  window.addEventListener('hashchange', syncHash, { signal });
  window.addEventListener('popstate', syncHash, { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else schedule();
  }, { signal });

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const link = event.target.closest('a[href^="#"]');
    if (!link || link.hasAttribute('data-case-link')) return;
    const target = hashTarget(link.hash);
    if (!target || !goTo(target, 'smooth')) return;

    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }, { signal });

  runway.addEventListener('focusin', event => {
    const index = sceneFor(event.target);
    if (index >= 0 && index !== sceneIndex && index !== destination?.index) goTo(event.target, 'instant');
  }, { signal });

  return {
    goTo,
    unmount() {
      lifecycle.abort();
      dimensions.disconnect();
      intersection.disconnect();
      stop();
      runway.removeAttribute('data-journey');
      delete runway.dataset.journeyCurrent;
      canvas.style.removeProperty('transform');
      return scenes[sceneIndex];
    },
  };
}

function setupJourney() {
  const runway = document.querySelector('.journey');
  const viewport = runway?.querySelector('.journey-window');
  const canvas = viewport?.querySelector('.journey-canvas');
  const scenes = [...canvas?.querySelectorAll(':scope > [data-journey-scene]') ?? []];
  if (scenes.length !== 5 || !supportsReelLayout() || !CSS.supports('overflow', 'clip') ||
      typeof ResizeObserver !== 'function' || typeof IntersectionObserver !== 'function') return;

  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  const sync = () => {
    if (motion.matches) {
      activeJourney = mountJourney(runway, viewport, canvas, scenes);
    } else if (activeJourney) {
      const scene = activeJourney.unmount();
      activeJourney = undefined;
      scene.scrollIntoView({ block: 'start', behavior: 'instant' });
      runway.dispatchEvent(new Event('journey:scenechange', { bubbles: true }));
    }
  };

  sync();
  motion.addEventListener('change', sync);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    activeJourney?.unmount();
    motion.removeEventListener('change', sync);
  });
}

if (typeof document !== 'undefined') {
  document.querySelector('.project-capture img')?.decode?.().catch(() => {});
  document.fonts.ready.then(setupJourney);
}
