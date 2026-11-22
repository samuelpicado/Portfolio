function setupWelcome() {
  // A shared link to a section or case should open its destination directly.
  if (location.hash) return;

  const dialog = document.getElementById('portfolio-welcome');
  if (typeof dialog?.showModal !== 'function') return;
  const enter = document.getElementById('welcome-enter');
  const home = document.getElementById('inicio');
  const canvas = dialog.querySelector('.welcome-light');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const lifetime = new AbortController();
  const { signal } = lifetime;
  let release;
  let closing = false;

  function close(focusHome = false) {
    if (signal.aborted) return;
    lifetime.abort();
    release?.();
    dialog.close();
    delete dialog.dataset.lit;
    if (focusHome) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      home.focus({ preventScroll: true });
    }
  }

  function enterPortfolio() {
    if (closing) return;
    closing = true;
    if (reducedMotion.matches) {
      close(true);
      return;
    }
    const fade = dialog.animate({ opacity: [1, 0] }, {
      duration: 380,
      easing: 'cubic-bezier(.2, .75, .25, 1)',
      fill: 'forwards',
    });
    fade.finished.then(() => close(true), () => close(true));
    signal.addEventListener('abort', () => fade.cancel(), { once: true });
  }

  enter.addEventListener('click', enterPortfolio, { signal });
  dialog.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey ||
        ['Control', 'Meta', 'Alt', 'AltGraph', 'Shift'].includes(event.key)) return;
    event.preventDefault();
    enterPortfolio();
  }, { signal });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    enterPortfolio();
  }, { signal });
  dialog.addEventListener('close', () => close(), { signal });
  dialog.addEventListener('pointermove', event => event.stopPropagation(), { passive: true, signal });
  canvas.addEventListener('webglcontextlost', () => delete dialog.dataset.lit, { signal });
  window.addEventListener('pagehide', () => close(), { once: true, signal });

  dialog.dataset.loading = '';
  dialog.showModal();
  import('./welcome-light.js')
    .then(({ startWelcomeLight }) => signal.aborted ? null : startWelcomeLight(canvas, { signal }))
    .then(dispose => {
      if (!dispose) return;
      if (signal.aborted) {
        dispose();
        return;
      }
      release = dispose;
      dialog.dataset.lit = '';
    })
    .catch(() => { /* A renderer failure leaves the static word. */ })
    .finally(() => delete dialog.dataset.loading);
}

setupWelcome();
