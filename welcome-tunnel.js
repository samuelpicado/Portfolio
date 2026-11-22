const turn = 2 * Math.PI;
const black = '#010101';

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

  function draw({ x, y, rx, ry, progress, opacity = 1 }) {
    context.clearRect(0, 0, width, height);
    if (!opacity || rx <= 0 || ry <= 0 || !width || !height) return;

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

  resize();
  return { resize, draw };
}
