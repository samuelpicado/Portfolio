const turn = 2 * Math.PI;
const black = '#010101';
const lavender = '#bbabd8';
const points = Array.from({ length: 16 }, (_, index) => {
  const angle = index * 2.39996 + .25;
  const radius = .29 + .15 * (index * 7 % 16) / 15;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    depth: 1.26 + .62 * (index * 11 % 16) / 15,
    size: 1.4 + .65 * (index * 3 % 16) / 15,
  };
});

export function mountWelcomeTunnel(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return { resize() {}, draw() {} };

  let width = 0;
  let height = 0;

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const density = Math.min(devicePixelRatio, 1.5);
    const pixelWidth = Math.max(1, Math.round(bounds.width * density));
    const pixelHeight = Math.max(1, Math.round(bounds.height * density));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    width = bounds.width;
    height = bounds.height;
    if (width && height) context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
  }

  function drawRim(x, y, rx, ry, progress, opacity) {
    const radius = Math.min(rx, ry);
    const feather = Math.min(.26, Math.max(5, Math.min(26, radius * .13)) / radius);
    // Finish the feather before the welcome layer's mask begins to turn opaque.
    const edge = .98;
    const clear = edge - feather;
    const corner = Math.hypot(Math.max(x, width - x) / rx, Math.max(y, height - y) / ry);
    if (corner <= clear) return;

    const spread = Math.min(1, progress / .5);
    const mouth = 1.35 + Math.max(0, corner * 1.015 - 1.35) * spread ** 2 * (3 - 2 * spread);
    context.save();
    context.translate(x, y);
    context.scale(rx, ry);
    context.globalAlpha = opacity;

    const mask = context.createRadialGradient(0, 0, clear, 0, 0, edge);
    mask.addColorStop(0, 'rgba(1, 1, 1, 0)');
    mask.addColorStop(.25, 'rgba(1, 1, 1, .12)');
    mask.addColorStop(.5, 'rgba(1, 1, 1, .5)');
    mask.addColorStop(.75, 'rgba(1, 1, 1, .88)');
    mask.addColorStop(1, black);
    context.fillStyle = mask;
    context.beginPath();
    context.arc(0, 0, mouth, 0, turn);
    context.fill();
    context.restore();
  }

  function drawPoints(x, y, rx, ry, zoom, trailingZoom, opacity) {
    const narrow = width < 520;
    const count = narrow ? 11 : points.length;
    const trailLimit = narrow ? 25 : 36;
    context.save();
    context.lineCap = 'round';
    context.fillStyle = lavender;

    for (let index = 0; index < count; index++) {
      const point = points[index];
      const depth = point.depth - .68 * zoom;
      const trailingDepth = point.depth - .68 * trailingZoom;
      const offsetX = point.x * width / depth;
      const offsetY = point.y * height / depth;
      const headX = x + offsetX;
      const headY = y + offsetY;
      const trailScale = 1 - depth / trailingDepth;
      const trailX = offsetX * trailScale;
      const trailY = offsetY * trailScale;
      const length = Math.hypot(trailX, trailY);
      const size = Math.min(2.5, point.size / depth);
      const wall = Math.max(0, Math.min(1, (Math.hypot(offsetX / rx, offsetY / ry) - .78) / .32));
      context.globalAlpha = opacity * (.29 + .27 * wall);

      if (length > size) {
        const limit = Math.min(1, trailLimit / length);
        const tailX = headX - trailX * limit;
        const tailY = headY - trailY * limit;
        const glow = context.createLinearGradient(tailX, tailY, headX, headY);
        glow.addColorStop(0, 'transparent');
        glow.addColorStop(1, lavender);
        context.strokeStyle = glow;
        context.lineWidth = size;
        context.beginPath();
        context.moveTo(tailX, tailY);
        context.lineTo(headX, headY);
        context.stroke();
      }

      context.beginPath();
      context.arc(headX, headY, size / 2, 0, turn);
      context.fill();
    }
    context.restore();
  }

  function draw({ x, y, rx, ry, progress, opacity, zoom, trailingZoom, pointsOpacity }) {
    context.clearRect(0, 0, width, height);
    if (rx <= 0 || ry <= 0 || !width || !height) return;

    if (opacity > 0) drawRim(x, y, rx, ry, progress, opacity);
    if (pointsOpacity > 0) drawPoints(x, y, rx, ry, zoom, trailingZoom, pointsOpacity);
  }

  resize();
  return { resize, draw };
}
