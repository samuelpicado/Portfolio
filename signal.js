import { clamp, cubic, mix, smoothPhase } from './signal-motion.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const root = document.documentElement;

function darkTheme() {
  return root.dataset.theme ? root.dataset.theme === 'dark' : systemDark.matches;
}

function fitCanvas(canvas, context, width, height) {
  const ratio = Math.min(devicePixelRatio, 1.5);
  const pixelsWide = Math.ceil(width * ratio);
  const pixelsHigh = Math.ceil(height * ratio);
  if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
    canvas.width = pixelsWide;
    canvas.height = pixelsHigh;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function setupOpeningPoints(canvas, stars = false) {
  const context = canvas?.getContext('2d');
  if (!context || typeof ResizeObserver !== 'function' || typeof IntersectionObserver !== 'function') return;

  const hero = canvas.parentElement;
  let points = [];
  let bounds;
  let pointer;
  let visible = false;
  let lastPaint = 0;
  let elapsed = 0;
  let frame = 0;

  function schedulePaint() {
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(paint);
  }

  function syncPaint() {
    if (visible && !document.hidden) {
      schedulePaint();
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      lastPaint = 0;
      pointer = undefined;
    }
  }

  function paint(now) {
    frame = 0;
    const moving = !reducedMotion.matches;
    if (moving && lastPaint && now - lastPaint < 25) {
      schedulePaint();
      return;
    }
    elapsed += lastPaint ? Math.min(now - lastPaint, 70) : 0;
    lastPaint = now;

    const rect = canvas.getBoundingClientRect();
    const { width, height } = rect;
    if (!width || !height) return;
    if (!bounds || bounds.width !== width || bounds.height !== height) {
      fitCanvas(canvas, context, width, height);
      const spacing = stars ? 34 : width < 520 ? 24 : 30;
      points = [];
      for (let row = 0; row * spacing < height; row++) {
        for (let column = 0; column * spacing < width; column++) {
          const phase = row * 2.39996 + column * 1.618;
          points.push({
            x: (column + .5) * spacing + Math.sin(phase * 2.1) * (stars ? 16 : 5),
            y: (row + .5) * spacing + Math.cos(phase * 1.9) * (stars ? 16 : 5),
            phase,
            size: 1.4 + (1 + Math.cos(phase * 3)) * .35,
            offsetX: 0,
            offsetY: 0,
          });
        }
      }
      bounds = rect;
    }

    const dark = darkTheme();
    const time = elapsed / 1000;
    const cursorX = pointer ? pointer.x - rect.left : 0;
    const cursorY = pointer ? pointer.y - rect.top : 0;
    const radius = width < 520 ? 96 : 144;
    const strength = width < 520 ? 70 : 84;
    const radiusSquared = radius * radius;
    context.clearRect(0, 0, width, height);
    context.globalAlpha = dark ? .42 : .28;
    context.fillStyle = dark ? '#bbabd8' : '#675080';

    for (const point of points) {
      const x = point.x + (moving ? Math.cos(point.phase + time * .71) * 6 : 0);
      const y = point.y + (moving ? Math.sin(point.phase + time * .85) * 7 : 0);
      const dx = x - cursorX + .01;
      const dy = y - cursorY;
      const distanceSquared = dx * dx + dy * dy;
      let push = 0;
      if (moving && pointer && distanceSquared < radiusSquared) {
        const distance = Math.sqrt(distanceSquared);
        push = (1 - distance / radius) ** 2 * strength / Math.max(distance, .01);
      }
      point.offsetX = moving ? point.offsetX * .76 + dx * push * .24 : 0;
      point.offsetY = moving ? point.offsetY * .76 + dy * push * .24 : 0;
      const px = x + point.offsetX, py = y + point.offsetY;
      if (stars) {
        const shine = .58 + .37 * Math.cos(point.phase * 4 + (moving ? time * 1.4 : 0));
        const prominent = Math.sin(point.phase * 12.78) > .98;
        const size = point.size * (prominent ? 1.4 : .63);
        context.globalAlpha = (dark ? .82 : .57) * shine;
        context.fillStyle = Math.cos(point.phase) > .6 ? (dark ? '#9bf9dd' : '#397b74') : (dark ? '#d6c8ff' : '#7650a8');
        context.beginPath();
        context.moveTo(px, py - size);
        context.lineTo(px + size * .64, py);
        context.lineTo(px, py + size);
        context.lineTo(px - size * .64, py);
        context.fill();
        if (prominent) {
          context.globalAlpha *= .42;
          context.fillRect(px - size * 1.9, py - .3, size * 3.8, .6);
          context.fillRect(px - .3, py - size * 1.9, .6, size * 3.8);
        }
      } else context.fillRect(px, py, point.size, point.size);
    }
    if (!hero.hasAttribute('data-points')) hero.dataset.points = '';
    if (moving) schedulePaint();
  }

  window.addEventListener('pointermove', (event) => {
    if (visible && !reducedMotion.matches && event.pointerType !== 'touch') {
      pointer = { x: event.clientX, y: event.clientY };
    }
  }, { passive: true });
  document.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) pointer = undefined;
  });
  document.addEventListener('visibilitychange', syncPaint);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncPaint();
  }).observe(hero);
  new ResizeObserver(schedulePaint).observe(hero);
  new MutationObserver(schedulePaint).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  systemDark.addEventListener('change', schedulePaint);
  reducedMotion.addEventListener('change', () => {
    pointer = undefined;
    schedulePaint();
  });
}

function setupNameJelly() {
  const name = document.querySelector('.opening-name');
  if (!name) return;

  const ripples = new Map();
  let last;
  name.addEventListener('pointermove', (event) => {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    const line = event.target.closest('.opening-name > span');
    if (!line || ripples.get(line)?.playState === 'running') return;

    const { left, width } = line.getBoundingClientRect();
    if (last?.line === line && Math.abs(event.clientX - last.x) < width / 4) return;
    last = { line, x: event.clientX };

    const pivot = Math.min(100, Math.max(0, (event.clientX - left) / width * 100));
    const lean = (pivot - 50) / 20;
    const frames = [
      'none',
      `scale(1.06, .87) skewX(${lean}deg)`,
      `scale(.965, 1.09) skewX(${-lean * .55}deg)`,
      'scale(1.015, .975)',
      'none',
    ];
    ripples.set(line, line.animate(frames.map(transform => ({
      transform, transformOrigin: `${pivot}% 62%`, easing: 'ease-out',
    })), { duration: 590 }));
  }, { passive: true });

  name.addEventListener('pointerleave', () => { last = undefined; });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) ripples.forEach(animation => animation.cancel());
    last = undefined;
  });
}

const branchRings = [13, 23, 33];

const fieldSteps = 120;
const contours = Array.from({ length: 34 }, (_, ring) => {
  const radius = .075 + ring * .0255;
  const color = ring < 14 ? 0 : ring < 24 ? 1 : 2;
  const points = Array.from({ length: fieldSteps }, (_, i) => {
    const angle = i * 2 * Math.PI / fieldSteps;
    const warp = 1 + .18 * Math.cos(angle * 3 + radius * 2.5) + .10 * Math.sin(angle * 2 - radius * 6);
    const x = Math.cos(angle) * radius * warp * .53;
    const y = Math.sin(angle) * radius * warp * .32;
    return [x * .95 - y * .4 + .15 * radius - .04, x * -.32 + y * .94 + .045 - radius * .12];
  });
  return { radius, color, points, isBranch: branchRings[color] === ring };
});
const fieldPoints = contours.flatMap(({ points }) => points);
const extent = fieldPoints.reduce(({ left, top, right, bottom }, [x, y]) => ({
  left: Math.min(left, x), top: Math.min(top, y),
  right: Math.max(right, x), bottom: Math.max(bottom, y),
}), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });

export function signalPorts(kind, width, height) {
  const spread = Math.min(7, width * .013, height * .019);
  return branchRings.map((_, index) => kind === 'contact'
    ? [width, height * .72 + (index - 1) * spread]
    : [width * .86 + (index - 1) * spread, height]);
}

// Sample each open strand once per size. A vertical/horizontal final tangent
// lets the line continue across the canvas boundary into the page-wide route.
function strandPoints(contact, width, height, [endX, endY], color) {
  const startX = width * (contact ? .30 : .47) + (color - 1) * 3;
  const startY = height * (contact ? .34 : .27) + (color - 1) * 3;
  const bendX = contact ? width * .58 : width * .65;
  const bendY = contact ? height * .33 : height * .32;
  const exitX = contact ? endX - width * .21 : endX;
  const exitY = contact ? endY : endY - height * .38;
  return Array.from({ length: fieldSteps + 1 }, (_, step) => {
    const u = step / fieldSteps;
    return [
      cubic(startX, bendX, exitX, endX, u),
      cubic(startY, bendY, exitY, endY, u),
    ];
  });
}

function setupSignalField(canvas, kind) {
  const context = canvas?.getContext('2d');
  if (!context) return;

  const contact = kind === 'contact';
  const plate = canvas.parentElement;
  const section = plate.closest('[data-journey-scene]');
  const map = section?.querySelector('.opening-map');
  const seam = contact ? 7 : 24;
  let pointer;
  let cursor;
  let cursorStrength = 0;
  let cursorTime = 0;
  let hovered = -1;
  let focused = -1;
  let frame = 0;
  let unfold = 0;
  let feed = 1;
  let movingJourney = false;
  let size;
  let ports;
  let strands;

  function paint() {
    frame = 0;
    movingJourney = Boolean(section?.closest('[data-journey]'));
    const bounds = canvas.getBoundingClientRect();
    const { width, height } = bounds;
    if (!width || !height) return;
    if (!size || size.width !== width || size.height !== height) {
      size = { width, height };
      ports = signalPorts(kind, width, height);
      strands = ports.map((port, index) => strandPoints(contact, width, height, port, index));
    }
    fitCanvas(canvas, context, width, height);
    context.clearRect(0, 0, width, height);
    if (!plate.hasAttribute('data-drawn')) plate.dataset.drawn = '';

    const dark = darkTheme();
    const colors = dark ? ['#c0a7ff', '#ff9e91', '#87ebcd'] : ['#624abe', '#a84a43', '#27766d'];
    const still = reducedMotion.matches;
    const amount = still ? 0 : unfold;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const leading = contact && !still && feed < 1;
    if (leading && feed === 0) return;

    const ease = smoothPhase(0, 1, amount);
    // At Contact keep the incoming tip joined until the outer wake has faded.
    const outlet = contact ? smoothPhase(.02, .34, amount) : smoothPhase(.08, .64, amount);
    // Fit the complete contour, including space for the pointer displacement.
    const air = Math.max(14, Math.min(29, width * .05, height * .085));
    const scale = contact ? Math.min(
      (width - air * 2) / (extent.right - extent.left),
      (height - air * 2) / (extent.bottom - extent.top),
    ) : Math.min(width, height * 1.35);
    const midX = contact ? width / 2 - (extent.right + extent.left) * scale / 2 : width * .52;
    const midY = contact ? height / 2 - (extent.top + extent.bottom) * scale / 2 : height * .50;
    const scaleX = contact ? scale : Math.max(scale, (width * 1.04 - midX) / extent.right);
    const active = focused < 0 ? hovered : focused;
    const tracking = !still && Boolean(pointer);
    const now = performance.now();
    const easePointer = 1 - Math.exp(-Math.max(1, cursorTime ? now - cursorTime : 16) / 53);
    cursorTime = now;
    if (tracking) {
      cursor ??= { ...pointer };
      cursor.x = mix(cursor.x, pointer.x, easePointer);
      cursor.y = mix(cursor.y, pointer.y, easePointer);
    }
    cursorStrength = still ? 0 : mix(cursorStrength, tracking ? 1 : 0, easePointer);
    if (!tracking && cursorStrength <= .007) {
      cursorStrength = 0;
      cursor = undefined;
    }
    const px = (cursor?.x ?? 0) - bounds.left, py = (cursor?.y ?? 0) - bounds.top;
    const reach = Math.max(66, Math.min(176, width * .29));
    const responsive = (contact ? 1.1 : .6) * cursorStrength * (1 - ease);

    for (const { radius, color, points, isBranch } of contours) {
      const emphasis = active < 0 || active === color ? 1 : .43;
      const peel = ease + .62 * ease * (1 - ease) * Math.cos(radius * 7);
      const alpha = (dark ? .58 : .54) * emphasis * (isBranch ? 1 : 1 - peel * .64);
      context.strokeStyle = colors[color];
      context.globalAlpha = alpha + (isBranch ? ease * .14 : 0);
      context.lineWidth = Math.min(1.35, .85 + width / 2000) * (isBranch ? 1.18 : 1 - peel * .42);
      context.beginPath();
      const start = leading ? (1 - feed) * fieldSteps : 0;
      for (let step = start; ; step = Math.min(fieldSteps, Math.floor(step) + 1)) {
        const i = Math.floor(step);
        const fraction = step - i;
        const a = points[(i + seam) % fieldSteps];
        const b = points[(i + seam + 1) % fieldSteps];
        let x = midX + mix(a[0], b[0], fraction) * scaleX;
        let y = midY + mix(a[1], b[1], fraction) * scale;
        const dx = px - x, dy = py - y;
        const force = responsive * Math.exp(-(dx * dx + dy * dy) / (reach * reach));
        x += (dx * .43 - dy * .22) * force;
        y += (dy * .43 + dx * .22) * force;

        if (amount) {
          // Release the seam first and pull the rest of each contour behind it.
          // The moving contour itself reaches the outlet, with no extra lead.
          const u = step / fieldSteps;
          const tip = smoothPhase(.54, 1, u);
          const blend = mix(peel, outlet, tip);
          const strand = strands[color];
          const next = strand[Math.min(i + 1, fieldSteps)];
          const spread = (radius * 42 - 10) * (1 - u) * (1 + .53 * Math.sin(u * 7 + radius * 7));
          x = mix(x, mix(strand[i][0], next[0], fraction) + (contact ? 0 : spread), blend);
          y = mix(y, mix(strand[i][1], next[1], fraction) + (contact ? spread : 0), blend);
        }
        if (step === start) context.moveTo(x, y);
        else context.lineTo(x, y);
        if (step === fieldSteps) break;
      }
      if (!amount) context.closePath();
      context.stroke();
    }
    if (!still && (Math.abs(cursorStrength - Number(tracking)) > .007 ||
      (tracking && Math.hypot(cursor.x - pointer.x, cursor.y - pointer.y) > .5))) schedulePaint();
    context.globalAlpha = 1;
  }

  const schedulePaint = () => { if (!frame) frame = requestAnimationFrame(paint); };
  const branchFor = (node) => {
    const route = node?.closest?.('[data-signal-route]');
    return route ? Number(route.dataset.signalRoute) : -1;
  };

  const pointerSurface = contact ? plate : section;
  pointerSurface?.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || reducedMotion.matches) return;
    if (!pointer) cursorTime = performance.now() - 16;
    pointer = { x: event.clientX, y: event.clientY };
    schedulePaint();
  }, { passive: true });
  pointerSurface?.addEventListener('pointerleave', () => {
    pointer = undefined;
    cursorTime = performance.now();
    hovered = -1;
    schedulePaint();
  });
  map?.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    hovered = branchFor(event.target);
    schedulePaint();
  });
  map?.addEventListener('pointerleave', () => { hovered = -1; schedulePaint(); });
  map?.addEventListener('focusin', (event) => { focused = branchFor(event.target); schedulePaint(); });
  map?.addEventListener('focusout', (event) => { focused = branchFor(event.relatedTarget); schedulePaint(); });
  if (typeof ResizeObserver === 'function') new ResizeObserver(schedulePaint).observe(plate);
  new MutationObserver(schedulePaint).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  systemDark.addEventListener('change', schedulePaint);
  reducedMotion.addEventListener('change', schedulePaint);
  schedulePaint();

  return (value, strandFeed = 1) => {
    const next = clamp(value);
    const nextFeed = clamp(strandFeed);
    if (unfold === next && feed === nextFeed &&
      movingJourney === Boolean(section?.closest('[data-journey]'))) return;
    unfold = next;
    feed = nextFeed;
    // The camera already runs in an animation frame. Paint in that same
    // frame so the joints never trail the route when the user scrolls fast.
    cancelAnimationFrame(frame);
    paint();
  };
}

function setupCursorSignal() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;
  canvas.id = 'cursor-signal';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  document.body.append(canvas);

  const life = 540;
  const points = [];
  let frame = 0;

  function paint(now) {
    frame = 0;
    const width = innerWidth;
    const height = innerHeight;
    fitCanvas(canvas, context, width, height);
    context.clearRect(0, 0, width, height);
    while (points.length && points[0].time + life <= now) points.shift();
    if (!points.length) {
      canvas.hidden = true;
      return;
    }

    const dark = darkTheme();
    const trace = dark ? '#c5a5ff' : '#6340b8';
    const terminal = dark ? '#9ef5db' : '#237b69';

    points.forEach(({ x, y, time, linked }, index) => {
      const alpha = Math.max(0, 1 - (now - time) / life);
      const before = points[index - 1];
      if (before && time - before.time < 150 && Math.hypot(x - before.x, y - before.y) < 230) {
        const turn = Math.sign(x - before.x) * Math.min(Math.abs(x - before.x), Math.abs(y - before.y));
        context.globalAlpha = alpha * (linked ? .86 : .53);
        context.strokeStyle = linked ? terminal : trace;
        context.lineWidth = linked ? 1.7 : 1.2;
        context.beginPath();
        context.moveTo(before.x, before.y);
        context.lineTo(x - turn, before.y);
        context.lineTo(x, y);
        context.stroke();
      }

      const leading = index === points.length - 1;
      if (index % 4 === 0 || leading) {
        context.save();
        context.translate(x, y);
        context.rotate(Math.PI / 4);
        context.globalAlpha = alpha * .8;
        context.fillStyle = linked ? terminal : trace;
        const diameter = leading ? 5 : linked ? 3.5 : 2.5;
        context.fillRect(-diameter / 2, -diameter / 2, diameter, diameter);
        if (leading) {
          const ring = 11 + 11 * (1 - alpha);
          context.strokeStyle = linked ? terminal : trace;
          context.globalAlpha = alpha * .36;
          context.lineWidth = 1;
          context.strokeRect(-ring / 2, -ring / 2, ring, ring);
        }
        context.restore();
      }
    });
    frame = requestAnimationFrame(paint);
  }

  document.addEventListener('pointermove', (event) => {
    if (reducedMotion.matches || !['mouse', 'pen'].includes(event.pointerType)) return;
    const last = points[points.length - 1];
    if (last && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 3) return;
    points.push({
      x: event.clientX, y: event.clientY, time: performance.now(),
      linked: !!event.target.closest?.('a, button, summary'),
    });
    if (points.length > 26) points.shift();
    if (!frame) {
      canvas.hidden = false;
      frame = requestAnimationFrame(paint);
    }
  }, { passive: true });

  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    points.length = 0;
    cancelAnimationFrame(frame);
    frame = 0;
    canvas.hidden = true;
  });
}

setupOpeningPoints(document.querySelector('#opening-points'));
setupOpeningPoints(document.querySelector('#contact-stars'), true);
setupNameJelly();
const unfoldOpening = setupSignalField(document.querySelector('#signal-field'), 'opening');
const unfoldContact = setupSignalField(document.querySelector('#contact-field'), 'contact');

export function setSignalUnfold(opening, contact, feed = 1) {
  unfoldOpening?.(opening);
  unfoldContact?.(contact, feed);
}

setupCursorSignal();
