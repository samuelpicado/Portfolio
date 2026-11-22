import { playWelcomeFlight } from './welcome-flight.js';
import { loadWelcomeSound, playWelcomeSound } from './welcome-sound.js';
import { mountWelcomeTunnel } from './welcome-tunnel.js';

function setupWelcome() {
  // A shared link to a section or case should open its destination directly.
  if (location.hash) return;

  const dialog = document.getElementById('portfolio-welcome');
  if (typeof dialog?.showModal !== 'function' || typeof ResizeObserver !== 'function') return;
  const enter = dialog.querySelector('#welcome-enter');
  const letter = dialog.querySelector('.welcome-letter-o');
  const home = document.getElementById('inicio');
  const canvas = dialog.querySelector('.welcome-light');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const aperture = 'radial-gradient(transparent, black)';
  const canReveal = CSS.supports('mask-image', aperture) || CSS.supports('-webkit-mask-image', aperture);
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const recordingBytes = !canReveal || reducedMotion.matches ? undefined : loadWelcomeSound(signal);
  let portal;
  let tunnel;
  let release;
  let closing = false;
  let lightReveal = 0;
  let fallbackStart;
  let idleFrame = 0;
  let idleStart = performance.now();
  let lastIdle = 0;

  function getDoor() {
    if (portal?.target) return portal.target;
    const glyph = letter.getBoundingClientRect();
    const bounds = dialog.getBoundingClientRect();
    return {
      x: glyph.left - bounds.left + glyph.width / 2,
      y: glyph.top - bounds.top + glyph.height / 2,
      rx: glyph.width * .29,
      ry: glyph.height * .24,
    };
  }

  function updateGeometry() {
    portal?.resize();
    tunnel?.resize();
    const door = getDoor();
    if (door.rx > 0 && door.ry > 0) {
      dialog.style.setProperty('--welcome-portal-x', `${door.x}px`);
      dialog.style.setProperty('--welcome-portal-y', `${door.y}px`);
      dialog.style.setProperty('--welcome-portal-width', `${door.rx * 2}px`);
      dialog.style.setProperty('--welcome-portal-height', `${door.ry * 2}px`);
      dialog.dataset.portal = '';
    }
    if (reducedMotion.matches && !closing) drawPortal(0);
  }

  function drawPortal(time, options) {
    if (!portal) return;
    const fallback = !dialog.hasAttribute('data-lit') && !dialog.hasAttribute('data-loading');
    dialog.toggleAttribute('data-portal-text', fallback);
    const quiet = reducedMotion.matches;
    let reveal = lightReveal;
    if (fallback) {
      const now = performance.now();
      fallbackStart ??= now - 1600 * Math.sqrt(lightReveal);
      reveal = Math.min(1, (now - fallbackStart) / 1600) ** 2;
    }
    if (options?.launch && time >= options.cues[0]) reveal = 1;
    portal.draw(time, { ...options, fallback, quiet, reveal: quiet ? 1 : reveal });
  }

  function idle(now) {
    idleFrame = 0;
    if (closing || document.hidden || signal.aborted) return;
    if (now - lastIdle > 30) {
      drawPortal((now - idleStart) / 1000);
      lastIdle = now;
    }
    idleFrame = requestAnimationFrame(idle);
  }

  function updateIdle() {
    cancelAnimationFrame(idleFrame);
    if (!portal || closing || document.hidden || signal.aborted) return;
    if (reducedMotion.matches) drawPortal(0);
    else {
      idleStart = performance.now();
      idleFrame = requestAnimationFrame(idle);
    }
  }

  function releaseLight() {
    release?.();
    release = undefined;
  }

  function close(focusHome = false) {
    if (signal.aborted) return;
    lifetime.abort();
    releaseLight();
    dialog.close();
    delete document.documentElement.dataset.welcomeOpen;
    delete dialog.dataset.lit;
    if (focusHome) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      home.focus({ preventScroll: true });
    }
  }

  function enterPortfolio() {
    if (closing) return;
    closing = true;
    if (reducedMotion.matches || !canReveal) {
      close(true);
      return;
    }
    cancelAnimationFrame(idleFrame);
    window.scrollTo({ top: 0, behavior: 'instant' });
    playWelcomeSound({
      recordingBytes: recordingBytes ?? loadWelcomeSound(signal), signal,
      startFlight(startedAt) {
        playWelcomeFlight({
          dialog, home, portal, tunnel, startedAt, drawPortal, signal,
          target: getDoor(),
          darken: releaseLight,
          finish: () => close(true),
        });
      },
    });
  }

  enter.addEventListener('click', event => {
    if (event.detail === 0) {
      enterPortfolio();
      return;
    }
    const bounds = dialog.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const door = getDoor();
    const inside = portal?.contains ? portal.contains(x, y)
      : ((x - door.x) / door.rx) ** 2 + ((y - door.y) / door.ry) ** 2 <= 1;
    if (inside) enterPortfolio();
  }, { signal });
  dialog.addEventListener('keydown', event => {
    if (closing && event.key === 'Escape') {
      event.preventDefault();
      close(true);
    }
  }, { signal });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (closing) close(true);
  }, { signal });
  dialog.addEventListener('close', () => close(), { signal });
  dialog.addEventListener('pointermove', event => event.stopPropagation(), { passive: true, signal });
  canvas.addEventListener('webglcontextlost', () => {
    delete dialog.dataset.lit;
    if (!closing) drawPortal(0);
  }, { signal });
  document.addEventListener('visibilitychange', () => {
    if (closing && document.hidden) close(true);
    else updateIdle();
  }, { signal });
  reducedMotion.addEventListener('change', () => {
    if (closing && reducedMotion.matches) close(true);
    else updateIdle();
  }, { signal });
  window.addEventListener('pagehide', () => close(), { once: true, signal });

  dialog.dataset.loading = '';
  dialog.showModal();
  document.documentElement.dataset.welcomeOpen = '';
  tunnel = mountWelcomeTunnel(dialog.querySelector('.welcome-tunnel'));
  updateGeometry();
  const geometry = new ResizeObserver(updateGeometry);
  geometry.observe(dialog);
  signal.addEventListener('abort', () => {
    geometry.disconnect();
    cancelAnimationFrame(idleFrame);
  }, { once: true });
  Promise.all([document.fonts.load('500 48px Bricolage', 'WELCOME'), import('./welcome-portal.js')]).then(([, { mountWelcomePortal }]) => {
    if (signal.aborted || closing) return;
    portal = mountWelcomePortal(dialog.querySelector('.welcome-portal'));
    updateGeometry();
    updateIdle();
  }).catch(() => { /* Keep the welcome available if the font cannot be measured. */ });

  import('./welcome-light.js')
    .then(({ startWelcomeLight }) => signal.aborted ? null : startWelcomeLight(canvas, {
      signal,
      onReveal: reveal => { lightReveal = reveal; },
    }))
    .then(dispose => {
      if (!dispose) return;
      if (signal.aborted || closing) {
        dispose();
        return;
      }
      release = dispose;
      dialog.dataset.lit = '';
    })
    .catch(() => { /* A renderer failure leaves the static word. */ })
    .finally(() => {
      delete dialog.dataset.loading;
      if (!closing && !signal.aborted) updateGeometry();
    });
}

setupWelcome();
