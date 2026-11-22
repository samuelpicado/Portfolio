import { sparkCues } from './welcome-sound.js';

const clamp = value => Math.max(0, Math.min(1, value));
const mix = (start, end, t) => start + (end - start) * t;

function ease(start, end, time) {
  const t = clamp((time - start) / (end - start));
  return t ** 3 * (t * (6 * t - 15) + 10);
}

const approachAt = time => ease(.69, 1.92, time);
const arrivalAt = time => ease(1.66, flightDuration, time);
const cameraZoom = (approach, arrival) => mix(mix(.18, .33, approach), 1, arrival);

export const flightDuration = 3.35;

export function playWelcomeFlight({ dialog, home, portal, tunnel, target, startedAt, drawPortal, darken, finish, signal }) {
  const plate = dialog.querySelector('.welcome-plate');
  const view = home.querySelector('.journey-window');
  const title = home.querySelector('#hero-title').getBoundingClientRect();
  const focusX = (title.left + title.width / 2) / dialog.clientWidth;
  const focusY = (title.top + title.height / 2) / dialog.clientHeight;
  let frame = 0;
  let dark = false;

  function draw(now) {
    const time = Math.max(0, Math.min(flightDuration, (now - startedAt) / 1000));
    const { clientWidth: width, clientHeight: height } = dialog;
    const origin = portal?.target ?? target;
    const center = ease(.44, 1.96, time);
    const x = mix(origin.x, width / 2, center);
    const y = mix(origin.y, height / 2, center);
    const roll = .22 * ease(.28, 1.42, time) + .45 * ease(.55, 2.02, time);
    const iris = ease(.24, .75, time);
    const approach = approachAt(time);
    const arrival = arrivalAt(time);
    const zoom = cameraZoom(approach, arrival);
    const fill = Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + 12;
    const distantWidth = mix(origin.rx, Math.min(width, height) * .13, approach);
    const distantHeight = mix(origin.ry, distantWidth, approach);
    const rx = mix(mix(1, distantWidth, iris), fill, arrival);
    const ry = mix(mix(1, distantHeight, iris), fill, arrival);
    const lift = 1 + 6 * ease(.23, 1.96, time);
    const veil = 1 - ease(.98, 1.95, time);

    dialog.style.setProperty('--welcome-aperture', `${rx}px ${ry}px at ${x}px ${y}px`);
    plate.style.transformOrigin = `${origin.x}px ${origin.y}px`;
    plate.style.transform = `translate(${x - origin.x}px, ${y - origin.y}px) rotate(${roll}rad) scale(${lift})`;
    plate.style.opacity = veil;

    // Keep the live page behind the aperture, framed on the name as the camera approaches.
    const scale = Math.min(1, Math.max(zoom, 2 * rx / width, 2 * ry / height));
    const shift = (center, focus, size, radius) => {
      const margin = Math.max(0, size * scale / 2 - radius);
      const offset = Math.min(margin, Math.max(-margin, (.5 - focus) * size * scale));
      return mix(center - size / 2 + offset, 0, arrival);
    };
    const shiftX = shift(x, focusX, width, rx);
    const shiftY = shift(y, focusY, height, ry);
    view.style.transform = `translate(${shiftX}px, ${shiftY}px) scale(${scale})`;

    if (veil > 0) drawPortal(time, { launch: true, cues: sparkCues });
    else if (!dark) {
      dark = true;
      darken();
    }

    // A fixed exposure gives the same trails at a given camera pose on every refresh rate.
    const exposureStart = time - .095;
    tunnel?.draw({
      x, y, rx, ry,
      progress: clamp((time - .51) / (flightDuration - .51)),
      opacity: ease(.39, .94, time) * (1 - ease(2.91, flightDuration, time)),
      zoom,
      trailingZoom: cameraZoom(approachAt(exposureStart), arrivalAt(exposureStart)),
      pointsOpacity: ease(.7, 1.25, time) * (1 - ease(3.02, flightDuration, time)),
    });

    if (time >= flightDuration) finish();
    else frame = requestAnimationFrame(draw);
  }

  signal.addEventListener('abort', () => {
    cancelAnimationFrame(frame);
    view.style.removeProperty('transform');
    plate.removeAttribute('style');
    dialog.style.removeProperty('--welcome-aperture');
    delete dialog.dataset.crossing;
  }, { once: true });

  draw(startedAt);
  dialog.dataset.crossing = '';
}
