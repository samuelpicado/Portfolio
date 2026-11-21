import { goToJourneyTarget } from './journey.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function setupContact() {
  const button = document.querySelector('#copy-email');
  const status = document.querySelector('#copy-status');
  const link = button?.closest('.email-row')?.querySelector('a[href^="mailto:"]');
  if (!link || !status || !navigator.clipboard?.writeText) return;

  button.hidden = false;
  button.addEventListener('click', async () => {
    status.textContent = '';

    try {
      await navigator.clipboard.writeText(link.getAttribute('href').slice(7));
      button.textContent = 'Copiado';
      status.textContent = 'Correo copiado al portapapeles.';
    } catch {
      button.textContent = 'Copiar';
      status.textContent = 'No se pudo copiar. Puedes seleccionar la dirección de correo.';
    }
  });
}

function setupTheme() {
  const button = document.querySelector('#theme-toggle');
  if (!button) return;

  const root = document.documentElement;
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let preferredTheme = root.dataset.theme;
  let transition;

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    button.setAttribute('aria-pressed', String(theme === 'dark'));
  };
  const applySystemTheme = () => applyTheme(systemTheme.matches ? 'dark' : 'light');

  if (preferredTheme === 'light' || preferredTheme === 'dark') applyTheme(preferredTheme);
  else applySystemTheme();
  systemTheme.addEventListener('change', () => {
    if (!preferredTheme) applySystemTheme();
  });

  button.hidden = false;
  button.addEventListener('click', () => {
    if (transition) return;
    preferredTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('portfolio-theme', preferredTheme);
    } catch {
      // The current page still switches themes when storage is unavailable.
    }

    if (reducedMotion.matches || !document.startViewTransition) {
      applyTheme(preferredTheme);
      return;
    }

    const bounds = button.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.style.setProperty('--theme-x', `${x}px`);
    root.style.setProperty('--theme-y', `${y}px`);
    root.style.setProperty('--theme-radius', `${radius}px`);
    root.classList.add('theme-transition');

    transition = document.startViewTransition(() => applyTheme(preferredTheme));
    transition.ready.catch(() => {});
    transition.finished.finally(() => {
      root.classList.remove('theme-transition');
      transition = undefined;
    });
  });

  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) transition?.skipTransition();
  });
}

function setupProjects() {
  const carousel = document.querySelector('#project-carousel');
  const track = carousel?.querySelector('.project-track');
  const controls = document.querySelector('.project-controls');
  const position = document.querySelector('#project-position');
  const status = document.querySelector('#project-status');
  const reelTitle = document.querySelector('#reel-title');
  if (!track || !controls || !position || !status || !reelTitle) return;

  const projects = [...track.children];
  if (projects.length < 2) return;

  const titles = projects.map(project => project.querySelector('h3').textContent);
  const links = document.querySelectorAll('[data-case-link]');
  const carouselLayout = matchMedia('(min-width: 57rem) and (min-height: 42rem)');
  const projectCount = projects.length;
  const copyCount = 2;

  const copy = (project) => {
    const clone = project.cloneNode(true);
    clone.removeAttribute('id');
    clone.removeAttribute('aria-labelledby');
    clone.inert = true;
    clone.setAttribute('aria-hidden', 'true');
    clone.dataset.reelCopy = '';
    for (const element of clone.querySelectorAll('[id]')) element.removeAttribute('id');
    return clone;
  };

  projects.forEach(project => { project.dataset.reelCase = project.id; });
  const before = projects.slice(-copyCount).map(copy);
  const after = projects.slice(0, copyCount).map(copy);
  const cards = [...before, ...projects, ...after];
  let current = -1;
  let frame = 0;
  let scrollIdle = 0;
  let lastScroll = 0;
  let direction = 1;
  let previousProgress = 0;

  const fitTitle = () => {
    const { offsetWidth } = reelTitle;
    if (offsetWidth) reelTitle.style.setProperty('--reel-title-scale', Math.max(1, innerWidth / offsetWidth));
  };

  const setCurrent = (index) => {
    if (index === current) return;
    const firstSelection = current < 0;
    projects[current]?.removeAttribute('data-current');
    current = index;
    projects[index].setAttribute('data-current', '');

    for (const link of links) {
      if (link.hash === '#' + projects[index].id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    position.textContent = `${String(index + 1).padStart(2, '0')} / ${String(projectCount).padStart(2, '0')}`;
    reelTitle.textContent = titles[index];
    fitTitle();
    if (!firstSelection && !reducedMotion.matches) {
      reelTitle.getAnimations().forEach(animation => animation.cancel());
      reelTitle.animate([
        { transform: `translateX(${direction * 5}%)`, opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 },
      ], { duration: 500, easing: 'cubic-bezier(.19, 1, .22, 1)' });
    }
  };

  const getGuide = (desktop) => carousel.getBoundingClientRect().top + carousel.clientTop +
    (desktop ? carousel.clientHeight / 2 : parseFloat(getComputedStyle(carousel).scrollPaddingTop) || 0);

  const getStop = (bounds, desktop) => bounds.top + (desktop ? bounds.height / 2 : 0);

  const trackCurrent = (settled = false) => {
    frame = 0;
    const desktop = carouselLayout.matches;
    const guide = getGuide(desktop);
    const stops = cards.map(card => getStop(card.getBoundingClientRect(), desktop));
    const first = stops[copyCount];
    const last = stops[copyCount + projectCount - 1];
    const firstCopy = stops[copyCount + projectCount];
    const lastCopy = stops[copyCount - 1];
    const scroll = carousel.scrollTop;
    direction = Math.sign(scroll - lastScroll) || direction;
    lastScroll = scroll;

    // The two copies make the progress wipe continuous across the loop.
    const beforeFirst = guide < first;
    const afterLast = guide > last;
    const fraction = beforeFirst ? (first - guide) / (first - lastCopy)
      : afterLast ? (firstCopy - guide) / (firstCopy - last)
      : (guide - first) / (last - first);
    const progress = Math.max(0, Math.min(1, fraction));
    // A wheel tick can skip straight to the first copy without painting the wipe.
    if (afterLast && progress < .03 && previousProgress > .15 && !reducedMotion.matches) {
      controls.style.setProperty('--reel-progress-before-wrap', previousProgress);
      controls.setAttribute('data-progress-jump', '');
    } else if (!beforeFirst && !afterLast && progress > .03) {
      controls.removeAttribute('data-progress-jump');
    }
    controls.toggleAttribute('data-progress-seam', beforeFirst || afterLast);
    controls.style.setProperty('--reel-progress', progress);
    previousProgress = progress;

    // Once an identical copy comes into focus, keep its offset on the real card.
    const pastStart = desktop ? guide < lastCopy + 1 : guide < first - 2;
    const pastEnd = guide >= firstCopy - 1;
    if (settled && (pastStart || pastEnd)) {
      const shift = pastEnd ? first - firstCopy : desktop ? last - lastCopy : firstCopy - first;
      lastScroll = scroll + shift;
      carousel.dataset.recentering = '';
      carousel.scrollTo({ top: lastScroll, behavior: 'instant' });
      requestAnimationFrame(() => {
        delete carousel.dataset.recentering;
        scheduleTracking();
      });
      return;
    }

    let best = Infinity;
    let active = 0;
    stops.forEach((stop, index) => {
      const offset = stop - guide;
      if (desktop && !reducedMotion.matches) {
        const depth = Math.max(-1, Math.min(1, offset / (carousel.clientHeight * 0.75)));
        cards[index].style.setProperty('--reel-offset', depth.toFixed(3));
        cards[index].style.setProperty('--reel-distance', Math.abs(depth).toFixed(3));
      }
      const distance = desktop ? Math.abs(offset) : offset <= 3 ? -offset : Infinity;
      if (distance < best) {
        best = distance;
        active = (index - copyCount + projectCount) % projectCount;
      }
    });

    setCurrent(active);
  };

  const scheduleTracking = () => {
    if (!frame) frame = requestAnimationFrame(() => trackCurrent());
  };

  const scrollToCard = (card, behavior) => {
    const desktop = carouselLayout.matches;
    const offset = getStop(card.getBoundingClientRect(), desktop) - getGuide(desktop);
    carousel.scrollTo({ top: carousel.scrollTop + offset, behavior });
  };

  const projectAt = hash => projects.find(card => '#' + card.id === hash);
  const journeyIsActive = () => document.getElementById('inicio').hasAttribute('data-journey');

  const centerProject = (project, behavior, focus = true) => {
    if (!goToJourneyTarget(carousel, behavior, { center: true })) {
      carousel.scrollIntoView({ block: 'center', inline: 'nearest', behavior });
    }
    const wrapsForward = behavior === 'smooth' && current === projectCount - 1 && project === projects[0];
    scrollToCard(wrapsForward ? after[0] : project, behavior);
    if (focus) project.focus({ preventScroll: true });
  };

  const goTo = (index) => {
    const target = (index + projectCount) % projectCount;
    if (target === current) return;
    status.textContent = `Caso ${target + 1} de ${projectCount}: ${titles[target]}`;
    const motion = !reducedMotion.matches;
    const destination = motion && index === -1 ? before.at(-1)
      : motion && index === projectCount ? after[0] : projects[target];
    scrollToCard(destination, motion ? 'smooth' : 'instant');
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-case-link]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!link.closest('.case-nav') && !journeyIsActive()) return;
    const project = projectAt(link.hash);
    if (!project) return;

    event.preventDefault();
    if (location.hash !== link.hash) {
      const previous = projectAt(location.hash);
      if (previous) history.replaceState({ ...history.state, reelCase: previous.id }, '');
      history.pushState({ ...history.state, reelCase: project.id }, '', link.hash);
    }
    centerProject(project, reducedMotion.matches ? 'instant' : 'smooth');
  });

  window.addEventListener('popstate', (event) => {
    const hash = location.hash;
    const project = projectAt(hash);
    if (project && (journeyIsActive() || project.id === event.state?.reelCase)) {
      requestAnimationFrame(() => {
        if (location.hash === hash) centerProject(project, 'instant');
      });
    }
  });

  track.prepend(...before);
  track.append(...after);
  carousel.dataset.ready = '';
  carousel.setAttribute('aria-describedby', 'reel-instructions');
  controls.hidden = false;
  const linkedProject = projectAt(location.hash);
  if (linkedProject) {
    if (journeyIsActive()) centerProject(linkedProject, 'instant', false);
    else linkedProject.scrollIntoView({ block: carouselLayout.matches ? 'center' : 'start', behavior: 'instant' });
  } else {
    scrollToCard(projects[0], 'instant');
  }
  trackCurrent();

  const hasScrollEnd = 'onscrollend' in carousel;
  carousel.addEventListener('scroll', () => {
    scheduleTracking();
    if (!hasScrollEnd) {
      clearTimeout(scrollIdle);
      scrollIdle = setTimeout(() => trackCurrent(true), 120);
    }
  }, { passive: true });
  if (hasScrollEnd) carousel.addEventListener('scrollend', () => trackCurrent(true));
  window.addEventListener('resize', () => {
    fitTitle();
    scheduleTracking();
  }, { passive: true });
  carouselLayout.addEventListener('change', () => {
    scrollToCard(projects[Math.max(current, 0)], 'instant');
    scheduleTracking();
  });
  controls.addEventListener('animationend', (event) => {
    if (event.animationName === 'reel-wrap') controls.removeAttribute('data-progress-jump');
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      controls.removeAttribute('data-progress-jump');
      reelTitle.getAnimations().forEach(animation => animation.cancel());
    }
    scheduleTracking();
  });
  carousel.addEventListener('keydown', (event) => {
    if (event.target !== carousel || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const targets = { ArrowUp: current - 1, ArrowDown: current + 1, Home: 0, End: projectCount - 1 };
    if (!Object.hasOwn(targets, event.key)) return;
    event.preventDefault();
    goTo(targets[event.key]);
  });
}

function setupMatchReplay() {
  const button = document.querySelector('#replay-match');
  const trace = document.querySelector('#match-trace');
  const status = document.querySelector('#match-status');
  if (!button || !trace || !status) return;

  const stops = [...trace.querySelectorAll('.match-stops > li')];
  let replay = 0;
  let timeline;

  const showStep = (step) => {
    for (const copy of document.querySelectorAll('.match-trace')) {
      copy.dataset.step = String(step);
      copy.querySelectorAll('.match-stops > li').forEach((stop, index) => {
        stop.toggleAttribute('data-passed', index < step);
      });
    }
  };

  const complete = () => {
    timeline = undefined;
    showStep(stops.length);
    status.textContent = 'La otra sesión recibe el evento y ve la ficha bloqueada.';
  };

  button.hidden = false;
  button.addEventListener('click', async () => {
    const run = ++replay;
    timeline?.cancel();
    status.textContent = '';
    showStep(0);
    if (reducedMotion.matches) {
      complete();
      return;
    }

    try {
      const { createTimeline } = await import('./assets/animation.js');
      if (run !== replay) return;
      if (reducedMotion.matches) {
        complete();
        return;
      }
      showStep(1);
      timeline = createTimeline({ autoplay: false })
        .call(() => showStep(2), 300)
        .call(complete, 650);
      timeline.play();
    } catch {
      if (run === replay) complete();
    }
  });

  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches || !timeline) return;
    timeline.cancel();
    complete();
  });
}

setupTheme();
setupMatchReplay();
// The carousel uses text height to locate its first real card.
document.fonts.ready.then(setupProjects);
setupContact();
