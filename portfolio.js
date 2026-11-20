// Contact and case navigation work independently of the motion bundle.
const copyButton = document.querySelector('#copy-email');
const copyStatus = document.querySelector('#copy-status');
const emailAddress = copyButton.closest('.email-row').querySelector('a').getAttribute('href').slice(7);

if (navigator.clipboard?.writeText) {
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    copyStatus.textContent = '';

    try {
      await navigator.clipboard.writeText(emailAddress);
      copyButton.textContent = 'Copiado';
      copyStatus.textContent = 'Correo copiado al portapapeles.';
    } catch {
      copyButton.textContent = 'Copiar';
      copyStatus.textContent = 'No se pudo copiar. Puedes seleccionar la dirección de correo.';
    }
  });
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

if (!reducedMotion.matches) {
  import('./assets/animation.js').then(({ animate, createTimeline, stagger }) => {
    if (reducedMotion.matches) return;

    createTimeline({ defaults: { ease: 'out(3)' } })
      .add('.hero-kicker span', { scaleX: [0.2, 1], duration: 420 }, 0)
      .add('.hero-line', {
        y: [14, 0], opacity: [0.75, 1], duration: 560, delay: stagger(90),
      }, 35);

    for (const details of document.querySelectorAll('.project-details')) {
      details.addEventListener('toggle', () => {
        if (!details.open || reducedMotion.matches) return;
        animate(details.querySelector('.case-content'), {
          opacity: [0.55, 1], transform: ['translateY(6px)', 'translateY(0)'],
        }, { duration: 0.24, ease: 'easeOut' });
      });
    }
  }).catch(() => {
    // The layout and native disclosure controls function without animation.
  });
}
