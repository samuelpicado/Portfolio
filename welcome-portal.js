import { layoutWelcomeWord } from './welcome-light.js';

const revolution = Math.PI * 2;
const idlePeriod = 4.4;
const arcStops = [-180, -108, -36, 36, 108, 180];
const innerGap = [52, 115];
const segments = [
  { tint: '#ffc750', level: .37, ignition: .18 },
  { tint: '#fff2a4', level: .58, ignition: .06 },
  { tint: '#ffdc6f', level: .51, ignition: .31 },
  { tint: '#efae33', level: .31, ignition: .48 },
  { tint: '#ffe88c', level: .42, ignition: .39 },
];

function variation(seed) {
  const value = Math.sin(seed * 127.1 + 43.7) * 43758.5453;
  return value - Math.floor(value);
}

function smooth(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function shimmer(time, index) {
  const position = time * (5.1 + index * .37);
  const slot = Math.floor(position);
  const start = variation(slot + index * 43);
  const end = variation(slot + index * 43 + 1);
  return start + (end - start) * smooth(position - slot);
}

function blackoutAt(time, index, seed) {
  const period = 1.6;
  const segmentSeed = seed + index * 43;
  const shiftedTime = time + variation(segmentSeed) * period;
  const sample = segmentSeed + Math.floor(shiftedTime / period) * 17;
  const phase = shiftedTime % period;
  const start = .08 + variation(sample + 1) * .79;
  const end = start + .16 + variation(sample + 2) * .40;
  return variation(sample) > .21 && phase >= start && phase < end;
}

function measureAperture(context, width, height, x, y) {
  const row = context.getImageData(0, y, width, 1).data;
  const column = context.getImageData(x, 0, 1, height).data;
  function edges(pixels, center) {
    let first = center;
    let last = center;
    while (first > 0 && pixels[first * 4 + 3] < 128) first--;
    while (last < pixels.length / 4 - 1 && pixels[last * 4 + 3] < 128) last++;
    return [(last + first) / 2, Math.max(1, (last - first) / 2 - .5)];
  }
  const [centerX, radiusX] = edges(row, x);
  const [centerY, radiusY] = edges(column, y);
  return { x: centerX, y: centerY, rx: radiusX, ry: radiusY };
}

function traceRims(context, width, height, center, density) {
  const pixels = context.getImageData(0, 0, width, height).data;
  const inner = [];
  const outer = [];

  // Find both edges of the actual glyph along rays from its counter.
  for (let angle = -180; angle <= 180; angle++) {
    const radians = angle * Math.PI / 180;
    const dx = Math.cos(radians);
    const dy = Math.sin(radians);
    let insideStroke = false;
    let innerDistance = 0;
    let outerDistance = 0;
    for (let distance = 0; ; distance += .5) {
      const x = Math.round(center.x + dx * distance);
      const y = Math.round(center.y + dy * distance);
      if (x < 0 || x >= width || y < 0 || y >= height) break;
      const ink = pixels[(y * width + x) * 4 + 3] >= 128;
      if (ink && !insideStroke) {
        innerDistance = Math.max(0, distance - .25);
        insideStroke = true;
      } else if (!ink && insideStroke) {
        outerDistance = distance - .25;
        break;
      }
    }
    const pointAt = distance => ({ x: (center.x + dx * distance + .5) / density, y: (center.y + dy * distance + .5) / density });
    inner.push(pointAt(innerDistance));
    outer.push(pointAt(outerDistance || innerDistance));
  }

  return { inner, outer };
}

function smoothRim(points) {
  return points.map((point, index) => {
    const previous = points[(index + 359) % 360];
    const next = points[(index + 1) % 360];
    return { x: (previous.x + 2 * point.x + next.x) / 4, y: (previous.y + 2 * point.y + next.y) / 4 };
  });
}

function paintSegment(context, rims, index, fontSize, density) {
  const start = arcStops[index];
  const end = arcStops[index + 1];
  function append(points, from, to) {
    if (from >= to) return;
    const first = points[from + 180];
    context.moveTo(first.x, first.y);
    for (let angle = from + 1; angle <= to; angle++) {
      const point = points[angle + 180];
      context.lineTo(point.x, point.y);
    }
  }

  context.beginPath();
  append(rims.outer, start, end);
  append(rims.inner, start, Math.min(end, innerGap[0]));
  append(rims.inner, Math.max(start, innerGap[1]), end);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = '#b67016';
  context.lineWidth = Math.max(1.4, fontSize * .014);
  context.shadowColor = '#e7aa36';
  context.shadowBlur = Math.max(4, fontSize * .042) * density;
  context.stroke();
  context.strokeStyle = segments[index].tint;
  context.lineWidth = Math.max(.7, fontSize * .007);
  context.shadowBlur = Math.max(1.7, fontSize * .015) * density;
  context.stroke();
}

function drawSparks(context, rims, offset, size, { age, seed, segment, drive, strong }) {
  if (age < 0 || age > .48 || drive < .30) return;

  const scale = Math.max(25, Math.min(84, size * 1.65));
  const count = strong ? 18 : 8;
  const start = arcStops[segment];
  const end = arcStops[segment + 1];
  const source = start + (end - start) * (.28 + variation(seed) * .44);
  context.lineCap = 'round';

  for (let i = 0; i < count; i++) {
    const identity = seed * 97 + i * 7;
    const delay = i < 4 ? 0 : variation(identity) * .047;
    const travel = age - delay;
    const life = .10 + variation(identity + 1) * .29;
    if (travel < 0 || travel > life) continue;

    const originAngle = Math.round(Math.max(start, Math.min(end, source + (variation(identity + 2) - .5) * 22)));
    const point = rims.outer[originAngle + 180];
    const angle = originAngle * Math.PI / 180 + (variation(identity + 3) - .5) * 1.7;
    const speed = scale * (.50 + variation(identity + 4) * 2.3) * (strong ? 1.86 : 1.14);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const gravity = scale * 5.2;
    const tailAge = Math.max(0, travel - (.012 + variation(identity + 5) * .030));
    const originX = offset.x + point.x;
    const originY = offset.y + point.y;
    const tailX = originX + vx * tailAge;
    const tailY = originY + vy * tailAge + gravity * tailAge ** 2;
    const tipX = originX + vx * travel;
    const tipY = originY + vy * travel + gravity * travel ** 2;
    const opacity = drive * (1 - travel / life) ** 1.55;
    const thickness = .35 + variation(identity + 6) * .63;

    if (travel > .001) {
      context.beginPath();
      context.moveTo(tailX, tailY);
      context.lineTo(tipX, tipY);
      context.globalAlpha = opacity * .20;
      context.strokeStyle = '#e88b29';
      context.lineWidth = thickness + 2;
      context.stroke();
      const streak = context.createLinearGradient(tailX, tailY, tipX, tipY);
      streak.addColorStop(0, 'transparent');
      streak.addColorStop(.54, '#ed9837');
      streak.addColorStop(1, '#fff1ad');
      context.globalAlpha = opacity;
      context.strokeStyle = streak;
      context.lineWidth = thickness;
      context.stroke();
    }

    context.globalAlpha = opacity;
    context.fillStyle = i % 4 === 0 ? '#fff8d4' : '#ffd783';
    context.beginPath();
    context.arc(tipX, tipY, thickness * .65, 0, revolution);
    context.fill();
  }
}

export function mountWelcomePortal(canvas) {
  const context = canvas.getContext('2d');
  const rim = document.createElement('canvas');
  const rimContext = rim.getContext('2d', { willReadFrequently: true });
  const sheet = document.createElement('canvas');
  const sheetContext = sheet.getContext('2d');
  if (!context || !rimContext || !sheetContext) return null;
  const blackoutSeed = Math.random() * 10000;

  let target;
  let width;
  let height;
  let left;
  let top;
  let density;
  let layout;
  let rims;

  function resize() {
    const nextWidth = canvas.clientWidth;
    const nextHeight = canvas.clientHeight;
    const nextDensity = Math.min(window.devicePixelRatio || 1, 1.25);
    if (!nextWidth || !nextHeight || (width === nextWidth && height === nextHeight && density === nextDensity)) return;

    width = nextWidth;
    height = nextHeight;
    density = nextDensity;
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    context.setTransform(density, 0, 0, density, 0, 0);

    layout = layoutWelcomeWord(context, width, height);
    const { word, fontSize, baseline } = layout;
    context.textAlign = 'left';
    const glyph = context.measureText('O');
    const glyphX = (width - context.measureText(word).width) / 2 + context.measureText('WELCO').width - glyph.width;
    const glyphLeft = glyphX - glyph.actualBoundingBoxLeft;
    const glyphRight = glyphX + glyph.actualBoundingBoxRight;
    const glyphTop = baseline - glyph.actualBoundingBoxAscent;
    const glyphBottom = baseline + glyph.actualBoundingBoxDescent;
    const bleed = Math.max(10, fontSize * .13);
    context.textAlign = 'center';

    left = Math.floor(glyphLeft - bleed);
    top = Math.floor(glyphTop - bleed);
    rim.width = Math.ceil((glyphRight + bleed - left) * density);
    rim.height = Math.ceil((glyphBottom + bleed - top) * density);
    rimContext.setTransform(density, 0, 0, density, 0, 0);
    rimContext.font = context.font;
    rimContext.textAlign = 'left';
    rimContext.textBaseline = context.textBaseline;
    rimContext.letterSpacing = context.letterSpacing;
    rimContext.fillText('O', glyphX - left, baseline - top);

    const midX = Math.round(((glyphLeft + glyphRight) / 2 - left) * density);
    const midY = Math.round(((glyphTop + glyphBottom) / 2 - top) * density);
    const inner = measureAperture(rimContext, rim.width, rim.height, midX, midY);
    target = { x: left + inner.x / density, y: top + inner.y / density, rx: inner.rx / density, ry: inner.ry / density };
    rims = traceRims(rimContext, rim.width, rim.height, inner, density);

    const strokes = { inner: smoothRim(rims.inner), outer: smoothRim(rims.outer) };
    sheet.width = rim.width * segments.length;
    sheet.height = rim.height;
    segments.forEach((_, index) => {
      sheetContext.save();
      sheetContext.setTransform(density, 0, 0, density, index * rim.width, 0);
      sheetContext.beginPath();
      sheetContext.rect(0, 0, rim.width / density, rim.height / density);
      sheetContext.clip();
      paintSegment(sheetContext, strokes, index, fontSize, density);
      sheetContext.restore();
    });
  }

  function draw(elapsed, { reveal = 1, launch = false, cues = [], fallback = false, quiet = false } = {}) {
    if (!target) return;
    context.globalAlpha = 1;
    context.clearRect(0, 0, width, height);
    if (fallback) {
      context.fillStyle = '#ede4d7';
      context.fillText(layout.word, width / 2, layout.baseline);
    }

    if (reveal <= 0) return;
    const cycle = Math.floor(elapsed / idlePeriod);
    const idleAge = elapsed % idlePeriod - 1.36 - variation(cycle) * .85;
    const strikes = [1, 2, 4, 0, 3];
    const bursts = quiet ? [] : launch
      ? cues.map((cue, index) => ({ age: elapsed - cue, seed: index + 1, segment: strikes[index % strikes.length] }))
      : [{ age: idleAge, seed: cycle + 4, segment: strikes[cycle % strikes.length] }];
    const drive = segments.map(segment => smooth((reveal - segment.ignition) / .35));
    if (!quiet && !launch && drive.every(level => level === 1)) {
      // Keep three arcs visible and leave the initial reveal and launch cues intact.
      let dark = 0;
      for (let index = 0; index < drive.length && dark < 2; index++) {
        if (!blackoutAt(elapsed, index, blackoutSeed)) continue;
        drive[index] = 0;
        dark++;
      }
    }

    segments.forEach((segment, index) => {
      if (!drive[index]) return;
      const base = segment.level * (quiet ? 1 : .61 + .61 * shimmer(elapsed, index));
      const flash = bursts.reduce((sum, burst) => {
        if (burst.age < 0) return sum;
        const pulse = Math.exp(-burst.age * 16) * (.78 + .22 * Math.cos(revolution * burst.age * 17));
        return sum + pulse * (burst.segment === index ? (launch ? .84 : .47) : .07);
      }, 0);
      context.globalAlpha = Math.min(1, (base + flash) * drive[index]);
      context.drawImage(sheet, index * rim.width, 0, rim.width, rim.height, left, top, rim.width / density, rim.height / density);
    });

    bursts.forEach(burst => drawSparks(context, rims, { x: left, y: top }, target.ry, {
      ...burst,
      drive: drive[burst.segment],
      strong: launch,
    }));
    context.globalAlpha = 1;
  }

  function contains(x, y) {
    if (!rims) return false;
    const dx = x - target.x;
    const dy = y - target.y;
    const angle = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
    const point = rims.inner[angle + 180];
    return Math.hypot(dx, dy) <= Math.hypot(left + point.x - target.x, top + point.y - target.y);
  }

  resize();
  return { get target() { return target; }, contains, draw, resize };
}
