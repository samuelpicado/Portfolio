export const clamp = value => Math.max(0, Math.min(1, value));
export const mix = (a, b, t) => a + (b - a) * t;

export function smoothPhase(start, end, value) {
  const t = clamp((value - start) / (end - start));
  return t * t * t * (t * (6 * t - 15) + 10);
}

export function cubic(a, b, c, d, t) {
  const u = 1 - t;
  return u ** 3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t ** 3 * d;
}
