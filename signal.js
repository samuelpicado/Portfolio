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

function setupOpeningPoints() {
  const canvas = document.querySelector('#opening-points');
  const context = canvas?.getContext('2d');
  if (!context) return;

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
      const spacing = width < 520 ? 24 : 30;
      points = [];
      for (let row = 0; row * spacing < height; row++) {
        for (let column = 0; column * spacing < width; column++) {
          const phase = row * 2.39996 + column * 1.618;
          points.push({
            x: (column + .5) * spacing + Math.sin(phase * 2.1) * 5,
            y: (row + .5) * spacing + Math.cos(phase * 1.9) * 5,
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
      context.fillRect(x + point.offsetX, y + point.offsetY, point.size, point.size);
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

function setupSignalField() {
  const canvas = document.querySelector('#signal-field');
  const context = canvas?.getContext('2d');
  if (!context) return;

  const plate = canvas.parentElement;
  const hero = plate.closest('.signal-hero');
  const map = hero.querySelector('.opening-map');
  const routes = [
    { ring: 13, vertex: 110, end: [.93, .13] },
    { ring: 23, vertex: 9, end: [.95, .47] },
    { ring: 33, vertex: 22, end: [.89, .81] },
  ];
  const angles = Array.from({ length: 121 }, (_, i) => i * Math.PI / 60);
  const contours = Array.from({ length: 34 }, (_, ring) => {
    const t = .075 + ring * .0255;
    const color = ring < 14 ? 0 : ring < 24 ? 1 : 2;
    const points = angles.map(angle => {
      const warp = 1 + .18 * Math.cos(angle * 3 + t * 2.5) + .10 * Math.sin(angle * 2 - t * 6);
      const x = Math.cos(angle) * t * warp * .53;
      const y = Math.sin(angle) * t * warp * .32;
      return [x * .95 - y * .4 + .15 * t - .04, x * -.32 + y * .94 + .045 - t * .12];
    });
    return { t, color, points, routeVertex: ring === routes[color].ring ? routes[color].vertex : -1 };
  });
  const rightmost = Math.max(...contours.at(-1).points.map(([x]) => x));
  let pointer;
  let hovered = -1;
  let focused = -1;
  let frame = 0;

  function paint() {
    frame = 0;
    const bounds = plate.getBoundingClientRect();
    const { width, height } = bounds;
    if (!width || !height) return;
    fitCanvas(canvas, context, width, height);
    context.clearRect(0, 0, width, height);

    const dark = darkTheme();
    const colors = dark ? ['#c0a7ff', '#ff9e91', '#87ebcd'] : ['#624abe', '#a84a43', '#27766d'];
    const cursor = pointer && !reducedMotion.matches
      ? [pointer.x - bounds.left, pointer.y - bounds.top] : null;
    const scale = Math.min(width, height * 1.35);
    const shift = cursor && cursor[0] > 0 && cursor[0] < width && cursor[1] > 0 && cursor[1] < height;
    const responsive = Math.max(-1, Math.min(1, shift ? (cursor[0] / width - .55) * 2 : 0));
    const active = focused < 0 ? hovered : focused;
    const midX = width * .52;
    const midY = height * .50;
    const scaleX = Math.max(scale, (width * 1.04 - midX) / rightmost);
    const anchors = [];
    context.lineWidth = Math.min(1.35, .85 + width / 2000);
    for (const { t, color, points, routeVertex } of contours) {
      context.strokeStyle = colors[color];
      context.globalAlpha = (dark ? .52 : .56) * (active < 0 || active === color ? 1 : .43);
      context.beginPath();
      for (const [index, [baseX, baseY]] of points.entries()) {
        let x = midX + baseX * scaleX;
        let y = midY + baseY * scale;
        if (shift) {
          const dx = x - cursor[0];
          const dy = y - cursor[1];
          const attract = Math.exp(-(dx * dx + dy * dy) / (scale * scale * .027));
          x += dx * attract * -.36 + responsive * t * 7;
          y += dy * attract * -.36;
        }
        if (index === routeVertex) anchors[color] = [x, y];
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.stroke();
    }

    routes.forEach(({ end }, index) => {
      const [startX, startY] = anchors[index];
      const [x, y] = [end[0] * width, end[1] * height];
      const isActive = index === active;
      const bend = x - Math.min(55, width * .12);
      context.globalAlpha = isActive ? 1 : dark ? .66 : .59;
      context.strokeStyle = colors[index];
      context.fillStyle = colors[index];
      context.lineWidth = isActive ? 2.05 : 1;
      context.beginPath();
      context.moveTo(startX, startY);
      context.lineTo(Math.max(startX, bend - Math.abs(y - startY)), startY);
      context.lineTo(bend, y);
      context.lineTo(x, y);
      context.stroke();
      context.fillRect(startX - 1.75, startY - 1.75, 3.5, 3.5);

      context.save();
      context.translate(x, y);
      context.rotate(Math.PI / 4);
      context.fillRect(-3.2, -3.2, 6.4, 6.4);
      context.globalAlpha *= .5;
      const outline = isActive ? 6.6 : 5.4;
      context.strokeRect(-outline, -outline, outline * 2, outline * 2);
      context.restore();
    });
    context.globalAlpha = 1;
    plate.dataset.drawn = '';
  }

  const schedulePaint = () => { if (!frame) frame = requestAnimationFrame(paint); };
  const branchFor = (node) => {
    const route = node?.closest?.('[data-signal-route]');
    return route ? Number(route.dataset.signalRoute) : -1;
  };

  hero.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || reducedMotion.matches) return;
    pointer = { x: event.clientX, y: event.clientY };
    schedulePaint();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => {
    pointer = undefined;
    hovered = -1;
    schedulePaint();
  });
  map.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    hovered = branchFor(event.target);
    schedulePaint();
  });
  map.addEventListener('pointerleave', () => { hovered = -1; schedulePaint(); });
  map.addEventListener('focusin', (event) => { focused = branchFor(event.target); schedulePaint(); });
  map.addEventListener('focusout', (event) => { focused = branchFor(event.relatedTarget); schedulePaint(); });
  new ResizeObserver(schedulePaint).observe(plate);
  new MutationObserver(schedulePaint).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  systemDark.addEventListener('change', schedulePaint);
  reducedMotion.addEventListener('change', schedulePaint);
  schedulePaint();
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
    const last = points.at(-1);
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

setupOpeningPoints();
setupNameJelly();
setupSignalField();
setupCursorSignal();
