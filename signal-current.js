import { clamp, mix, smoothPhase } from './signal-motion.js';
const noise = (x, seed) => .55 * Math.sin(x + seed) +
  .3 * Math.sin(x * 2.13 + seed * 1.71) + .15 * Math.sin(x * 4.07 - seed);

// The endpoints stay fixed at the two field outlets. Filaments breathe and
// cross one another around the same backbone without moving those joints.
function filament(sample, strand, width, progress, pointer) {
  const { x, y, nx, ny, distance, envelope } = sample;
  const local = noise(distance / 123 + progress * 19, strand * .47);
  const swell = .61 + .31 * noise(distance / 195, 8) + .18 * Math.sin(distance / 74);
  const spread = (strand / 8 + local * .37) * swell * width * envelope;
  const proximity = pointer ? Math.exp(-((x - pointer.x) ** 2 + (y - pointer.y) ** 2) / 6500) : 0;
  const bend = pointer ? ((pointer.x - x) * nx + (pointer.y - y) * ny) *
    proximity * .43 * envelope * pointer.strength : 0;
  const offset = spread + bend;
  return [x + nx * offset, y + ny * offset];
}

export function sampleCurrent(points, length, corridor) {
  const count = Math.ceil(length / 6);
  let segment = 1;
  const samples = Array.from({ length: count + 1 }, (_, index) => {
    const distance = index * length / count;
    while (segment < points.length - 1 && points[segment].distance < distance) segment++;
    const a = points[segment - 1], b = points[segment];
    const span = b.distance - a.distance || 1;
    const fraction = clamp((distance - a.distance) / span);
    const x = mix(a.x, b.x, fraction), y = mix(a.y, b.y, fraction);
    return { x, y, distance, envelope: smoothPhase(0, 110, distance) *
      smoothPhase(0, 136, length - distance) * corridor(x, y) };
  });
  return samples.map((sample, index) => {
    const a = samples[Math.max(0, index - 2)];
    const b = samples[Math.min(count, index + 2)];
    const size = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { ...sample, nx: (a.y - b.y) / size, ny: (b.x - a.x) / size };
  });
}

const dust = Array.from({ length: 460 }, (_, index) => {
  const hash = seed => {
    const result = Math.sin((index + 1) * seed) * 43758.5453;
    return result - Math.floor(result);
  };
  return { phase: hash(127.1), orbit: 17 * (hash(311.7) - .5), size: hash(74.7), depth: hash(269.5) };
});

function sampleAt(samples, index) {
  const a = samples[Math.floor(index)];
  const b = samples[Math.ceil(index)];
  const t = index % 1;
  return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t),
    nx: mix(a.nx, b.nx, t), ny: mix(a.ny, b.ny, t),
    envelope: mix(a.envelope, b.envelope, t), distance: mix(a.distance, b.distance, t) };
}

// Each translucent strip follows the same moving surface from head to tail.
function drawNebula(context, samples, amplitude, front, phase, pointer, nearView, color, opacity) {
  const left = [], right = [];
  function flush() {
    if (left.length > 1) {
      context.beginPath();
      context.moveTo(...left[0]);
      for (const point of left) context.lineTo(...point);
      for (let i = right.length - 1; i >= 0; i--) context.lineTo(...right[i]);
      context.closePath();
      context.fill();
    }
    left.length = right.length = 0;
  }

  for (let band = 0; band < 9; band++) {
    context.globalAlpha = opacity * (band < 5 ? .135 : .09);
    for (const sample of samples) {
      if (sample.distance >= front) break;
      if (!nearView(sample)) { flush(); continue; }
      const wave = noise(sample.distance / 57 - phase * 23, band * 2.08 + color);
      const eddy = noise(sample.distance / 121 - phase * 15, band + color * 2);
      const radius = amplitude * (.17 + band * .107) * (.82 + eddy * .4) *
        sample.envelope * smoothPhase(0, 164, front - sample.distance);
      const [x, y] = filament(sample, (band - 4) * .92 + wave * 4.5, amplitude, phase, pointer);
      left.push([x + sample.nx * radius, y + sample.ny * radius]);
      right.push([x - sample.nx * radius, y - sample.ny * radius]);
    }
    flush();
  }
}

export function mountCurrent(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return;
  let density = 0;
  let cachedWidth = 0;
  let cachedHeight = 0;
  const darkPreference = matchMedia('(prefers-color-scheme: dark)');
  const highContrast = matchMedia('(forced-colors: active)');

  return function paint(camera, wires, fronts, pointer, release) {
    const { x, y, width, height, progress } = camera;
    if (width !== cachedWidth || height !== cachedHeight) {
      density = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.ceil(width * density);
      canvas.height = Math.ceil(height * density);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      cachedWidth = width;
      cachedHeight = height;
    }
    canvas.style.transform = `translate(${x}px, ${y}px)`;
    context.setTransform(density, 0, 0, density, 0, 0);
    context.clearRect(0, 0, width, height);
    context.translate(-x, -y);
    if (release <= 0) return;
    const emerged = release;
    context.lineJoin = context.lineCap = 'round';
    const theme = document.documentElement.dataset.theme;
    const dark = theme ? theme === 'dark' : darkPreference.matches;
    const colors = highContrast.matches ? ['CanvasText', 'LinkText', 'GrayText'] :
      dark ? ['#c1a1ff', '#ff9d9e', '#8efbdd'] : ['#6540bc', '#bd574e', '#228379'];
    const amplitude = Math.min(46, width * .063);
    const nearView = sample => sample.x > x - 78 && sample.x < x + width + 78 &&
      sample.y > y - 78 && sample.y < y + height + 78;

    wires.forEach(({ geometry }, color) => {
      const { samples, length } = geometry;
      const front = fronts[color];
      if (front < 1) return;
      function draw(strand, from, to, weight, alpha) {
        if (to <= from) return;
        const start = clamp(from / length) * (samples.length - 1);
        const end = clamp(to / length) * (samples.length - 1);
        context.beginPath();
        let connected = false;
        for (let i = start; ; i = Math.min(end, Math.floor(i) + 1)) {
          const sample = Number.isInteger(i) ? samples[i] : sampleAt(samples, i);
          if (nearView(sample)) {
            const taper = .24 + .76 * smoothPhase(0, 112, front - sample.distance);
            const [px, py] = filament(sample, strand, amplitude * taper, progress, pointer);
            if (connected) context.lineTo(px, py);
            else context.moveTo(px, py);
            connected = true;
          } else connected = false;
          if (i >= end) break;
        }
        context.lineWidth = weight;
        context.globalAlpha = alpha * emerged;
        context.stroke();
      }
      context.strokeStyle = context.fillStyle = colors[color];
      if (!highContrast.matches) drawNebula(context, samples, amplitude, front, progress, pointer,
        nearView, color, emerged * (dark ? .63 : .49));
      for (let strand = -8; strand <= 8; strand++) {
        const delay = Math.abs(strand) * (7 + color * 2);
        const tip = front - delay * Math.sin(Math.PI * clamp(front / length));
        draw(strand, 0, tip, strand % 4 === 0 ? 1.45 : .78, strand % 4 === 0 ? .73 : .38);
      }
      for (let pulse = 0; pulse < 4; pulse++) {
        const end = front - pulse * 170 - 25 * color;
        const alpha = Math.min(1, end / 60, (length - front) / 95);
        if (alpha > 0) draw(pulse - 2, Math.max(0, end - 42 - pulse * 12), end, 2.3, .81 * alpha);
      }
      if (highContrast.matches) return;
      for (const particle of dust) {
        const at = (particle.phase + progress * (.5 + .48 * particle.depth) + color / 3) % 1;
        const sample = sampleAt(samples, at * (samples.length - 1));
        if (sample.distance > front || !nearView(sample)) continue;
        const [px, py] = filament(sample, particle.orbit, amplitude * 1.4, progress, pointer);
        const fade = Math.min(1, (front - sample.distance) / 32);
        context.globalAlpha = emerged * fade * ((dark ? .32 : .2) + particle.size * .38);
        const size = .45 + particle.size ** 3 * 2;
        context.fillRect(px, py, size, size);
      }
    });
    context.globalAlpha = 1;
  };
}
