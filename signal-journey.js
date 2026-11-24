import { subscribeJourneyFrame } from './journey.js';
import { setSignalUnfold, signalPorts } from './signal.js';
import { mountStaticSignalRoute } from './signal-static.js';
import { mountCurrent, sampleCurrent } from './signal-current.js';
import { clamp, cubic, mix, smoothPhase } from './signal-motion.js';

const phase = (a, b, value) => clamp((value - a) / (b - a));

function svg(tag, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function makeWire(color) {
  return { color };
}

function traceGeometry(stations) {
  const points = [];
  const landmarks = [];
  const tangents = stations.map(([x, y], index) => {
    const previous = stations[index - 1];
    const next = stations[index + 1];
    if (!previous) return [0, Math.hypot(next[0] - x, next[1] - y) * .46];
    if (!next) return [-Math.hypot(x - previous[0], y - previous[1]) * .48, 0];
    const dx = x - previous[0], dy = y - previous[1];
    const ex = next[0] - x, ey = next[1] - y;
    const before = Math.hypot(dx, dy) || 1;
    const after = Math.hypot(ex, ey) || 1;
    const handle = Math.min(before, after) * .26;
    return [(dx / before + ex / after) * handle, (dy / before + ey / after) * handle];
  });

  let length = 0;
  points.push({ x: stations[0][0], y: stations[0][1], distance: 0 });
  landmarks.push({ progress: 0, distance: 0 });
  for (let i = 1; i < stations.length; i++) {
    const [ax, ay] = stations[i - 1];
    const [bx, by, progress] = stations[i];
    const [tx, ty] = tangents[i - 1];
    const [ux, uy] = tangents[i];
    const steps = Math.max(12, Math.ceil(Math.hypot(bx - ax, by - ay) / 8));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const x = cubic(ax, ax + tx, bx - ux, bx, t);
      const y = cubic(ay, ay + ty, by - uy, by, t);
      const last = points.at(-1);
      length += Math.hypot(x - last.x, y - last.y);
      points.push({ x, y, distance: length });
    }
    if (progress !== undefined) landmarks.push({ progress, distance: length });
  }
  return { points, landmarks, length };
}

function distanceAt(landmarks, progress) {
  const i = landmarks.findIndex(mark => mark.progress >= progress);
  if (i <= 0) return i === 0 ? 0 : landmarks.at(-1).distance;
  const a = landmarks[i - 1], b = landmarks[i];
  const before = landmarks[i - 2], after = landmarks[i + 1];
  const span = b.progress - a.progress;
  const velocity = (b.distance - a.distance) / span;
  const slope = (x, y) => (y.distance - x.distance) / (y.progress - x.progress);
  const tangent = neighbor => 2 * velocity * neighbor / (velocity + neighbor);
  const startSpeed = before ? tangent(slope(before, a)) : 0;
  const endSpeed = after ? tangent(slope(b, after)) : 0;
  return cubic(a.distance, a.distance + span * startSpeed / 3,
    b.distance - span * endSpeed / 3, b.distance, phase(a.progress, b.progress, progress));
}

function setupSignalJourney() {
  const world = document.querySelector('.journey-canvas');
  const opening = world?.querySelector('#signal-field');
  const contact = world?.querySelector('#contact-field');
  const list = world?.querySelector('.project-index-list');
  if (!opening || !contact || !list) return;

  const wires = ['violet', 'coral', 'mint'].map(makeWire);
  const current = document.createElement('canvas');
  current.className = 'signal-current';
  current.setAttribute('aria-hidden', 'true');
  const paintCurrent = mountCurrent(current);
  const overlay = svg('svg', { class: 'signal-wiring', 'aria-hidden': 'true', focusable: 'false' });
  const branches = svg('g');
  overlay.append(branches);
  world.prepend(current, overlay);

  const listScene = list.closest('[data-journey-scene]');
  const openingScene = opening.closest('[data-journey-scene]');
  const repoLinks = [...list.querySelectorAll('li > a')];
  const taps = repoLinks.map((_, index) => {
    const group = svg('g', { class: 'wire-' + wires[index % wires.length].color + ' wire-tap' });
    const branch = svg('path');
    const pad = svg('circle', { r: 2.4 });
    group.append(branch, pad);
    branches.append(group);
    return { group, branch, pad };
  });
  let camera;
  let measured;
  let unmountStatic;
  let indexScrollFraction = 0;
  let measureFrame = 0;
  let inputFrame = 0;
  let pointer;
  let pointerTarget;
  let pointerStrength = 0;
  const viewport = world.parentElement;

  function measure() {
    measureFrame = 0;
    if (!camera) return;
    const { width: w, height: h, checkpoints: cp } = camera;
    const bounds = world.getBoundingClientRect();
    // The welcome tunnel can temporarily scale the entire viewport.
    const scale = bounds.width / world.offsetWidth || 1;
    function box(node) {
      const rect = node.getBoundingClientRect();
      return { x: (rect.left - bounds.left) / scale, y: (rect.top - bounds.top) / scale,
        w: rect.width / scale, h: rect.height / scale };
    }
    function ports(kind, node) {
      const rect = box(node);
      return signalPorts(kind, rect.w, rect.h).map(([x, y]) => [rect.x + x, rect.y + y]);
    }
    const start = ports('opening', opening);
    const end = ports('contact', contact);
    const directory = box(list);
    const heading = box(listScene.querySelector('.project-index-heading'));
    const row = list.firstElementChild;
    const description = box(row.querySelector('div'));
    const stacked = matchMedia('(max-width: 48rem)').matches;
    const gap = parseFloat(getComputedStyle(row).columnGap);
    const lane = stacked ? (directory.x + directory.w + 2 * w) / 2
      : description.x + description.w + gap / 2;
    const spread = stacked ? Math.min(3.5, (2 * w - lane) * .32) : Math.min(6, gap * .21);
    const inset = Math.min(46, Math.max(13, w * .031));
    const topLane = Math.max(22, Math.min(h * .125, heading.y - h - 24));
    const transfer = mix(cp[3], cp[4], .69);
    const listTravel = listScene.scrollHeight - listScene.clientHeight;
    const listClipBottom = h + listScene.clientTop + listScene.clientHeight;
    indexScrollFraction = listTravel > 0 ? clamp(listScene.scrollTop / listTravel) : 0;

    wires.forEach((wire, i) => {
      const offset = (i - 1) * spread;
      const [sx, sy] = start[i], [ex, ey] = end[i];
      const right = 2 * w - inset + offset;
      const vertical = lane + offset;
      const across = h + topLane - offset;
      const base = 3 * h - inset + offset;
      const workShoulder = w * (w >= 912 ? .78 : .81);
      // Each landmark belongs to a camera leg: down, right, down, then left.
      const geometry = traceGeometry([
        [sx, sy, 0],
        [mix(sx, w - inset + offset, .84), Math.max(sy + 34, h * .91)],
        [workShoulder + offset, h + (across - h) * (w < 768 ? .4 : .6)],
        [mix(workShoulder, w, .63), across + Math.min(12, h * .021), cp[1]],
        [vertical, across],
        [vertical, mix(Math.max(h, across), 2 * h, .72), cp[2]],
        [vertical, 2 * h - h * .045, mix(cp[2], cp[3], .3)],
        [mix(vertical, right, .68), 2 * h + Math.min(h * .088, 63) - offset],
        [right, 2 * h + h * .18],
        [right, 2 * h + h * .79, cp[3]],
        [mix(right, w, .18), base - Math.min(12, h * .018)],
        [w + w * .08, base],
        [w - inset - offset, mix(base, ey, .36)],
        [ex, ey, transfer],
      ]);
      geometry.samples = sampleCurrent(geometry.points, geometry.length, (x, y) => {
        const insideIndex = smoothPhase(w, w + 38, x) *
          smoothPhase(h + topLane + 8, h + topLane + 58, y) *
          (1 - smoothPhase(2 * h - 27, 2 * h + 20, y));
        const nearEdge = Math.min(Math.abs(x - w), x, 2 * w - x);
        const room = .24 + .76 * smoothPhase(0, 73, nearEdge);
        return mix(room, stacked ? .12 : .24, insideIndex);
      });
      wire.geometry = geometry;
    });

    repoLinks.forEach((link, i) => {
      const tap = taps[i];
      const strand = i % wires.length;
      const x = lane + (strand - 1) * spread;
      const target = box(link);
      const y = stacked ? target.y - 7 : target.y + target.h / 2;
      const endX = stacked ? target.x + target.w * .5 : target.x - 7;
      const nodeY = stacked ? y + 4 : y;
      tap.branch.setAttribute('d', stacked
        ? 'M' + x + ' ' + y + 'Q' + mix(x, endX, .7) + ' ' + y + ' ' + endX + ' ' + nodeY
        : 'M' + x + ' ' + y + 'H' + endX);
      tap.pad.setAttribute('cx', endX);
      tap.pad.setAttribute('cy', nodeY);
      // The list can scroll inside a scene on short displays. Clip its taps there.
      tap.inScene = y > h + Math.max(topLane + 12, listScene.clientTop) && nodeY < listClipBottom - 3;
      const rail = wires[strand].geometry.samples.find(p => Math.abs(p.x - x) < 13 && Math.abs(p.y - y) < 7);
      tap.distance = rail?.distance ?? Infinity;
    });
    measured = cp;
    paint();
  }

  function paint() {
    const { progress, checkpoints } = camera;
    const arrival = phase(checkpoints[3], 1, progress);
    const release = phase(0, checkpoints[1] * .66, progress);
    const closing = smoothPhase(.76, 1, arrival);
    setSignalUnfold(release, 1 - closing, smoothPhase(.69, .82, arrival));
    // Reading an overflowing list also advances the pulses. Merge back into
    // the camera path before entering the profile, including on reverse scroll.
    const exit = mix(checkpoints[2], checkpoints[3], .3);
    const reading = Math.min(phase(checkpoints[1], checkpoints[2], progress),
      1 - phase(checkpoints[2], exit, progress));
    const traceProgress = progress + indexScrollFraction * reading * (exit - checkpoints[2]);
    const distances = wires.map(({ geometry }) => distanceAt(geometry.landmarks, traceProgress));
    paintCurrent?.(camera, wires, distances, pointer && {
      x: pointer.x + camera.x, y: pointer.y + camera.y, strength: pointerStrength,
    },
      smoothPhase(.46, .8, release) * (1 - closing));
    taps.forEach((tap, i) => {
      tap.group.style.opacity = tap.inScene ? .74 * clamp((distances[i % wires.length] - tap.distance + 4) / 22) : 0;
    });
  }

  function scheduleMeasure() {
    if (camera && !measureFrame) measureFrame = requestAnimationFrame(measure);
  }
  function render() {
    if (!camera) {
      measured = null;
      setSignalUnfold(0, 0);
      unmountStatic ??= mountStaticSignalRoute(world);
    } else {
      unmountStatic?.();
      unmountStatic = undefined;
      if (measured !== camera.checkpoints) measure();
      else paint();
    }
  }
  const unsubscribe = subscribeJourneyFrame(frame => {
    camera = frame;
    render();
  });
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleMeasure) : null;
  [opening, contact, list].forEach(node => observer?.observe(node));
  function scheduleInput() {
    if (!camera || inputFrame) return;
    inputFrame = requestAnimationFrame(() => {
      inputFrame = 0;
      if (!camera) return;
      if (pointerTarget) {
        pointer ??= { ...pointerTarget };
        pointer.x = mix(pointer.x, pointerTarget.x, .23);
        pointer.y = mix(pointer.y, pointerTarget.y, .23);
      }
      const targetStrength = Number(Boolean(pointerTarget));
      pointerStrength = mix(pointerStrength, targetStrength, .2);
      paint();
      if (Math.abs(pointerStrength - targetStrength) > .006 ||
        (pointerTarget && Math.hypot(pointer.x - pointerTarget.x, pointer.y - pointerTarget.y) > .5)) scheduleInput();
      else if (!pointerTarget) pointer = undefined;
    });
  }
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  viewport.addEventListener('pointermove', event => {
    if (!camera || event.pointerType === 'touch' || document.querySelector('#portfolio-welcome[open]')) return;
    const rect = viewport.getBoundingClientRect();
    pointerTarget = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    scheduleInput();
  }, { passive: true, signal });
  viewport.addEventListener('pointerleave', () => { pointerTarget = undefined; scheduleInput(); }, { signal });
  const themeObserver = new MutationObserver(scheduleInput);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', scheduleInput, { signal });
  const scenes = [openingScene, listScene, contact.closest('[data-journey-scene]')];
  scenes.forEach(scene => scene.addEventListener('scroll', scheduleMeasure, { passive: true }));
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    unsubscribe();
    lifecycle.abort();
    unmountStatic?.();
    observer?.disconnect();
    themeObserver.disconnect();
    cancelAnimationFrame(measureFrame);
    cancelAnimationFrame(inputFrame);
    scenes.forEach(scene => scene.removeEventListener('scroll', scheduleMeasure));
    overlay.remove();
    current.remove();
  });
}

setupSignalJourney();
