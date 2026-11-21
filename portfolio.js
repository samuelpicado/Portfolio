const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function setupContact() {
  const button = document.querySelector('#copy-email');
  const status = document.querySelector('#copy-status');
  const link = button?.closest('.email-row')?.querySelector('a[href^="mailto:"]');
  if (!link || !status || !navigator.clipboard?.writeText) return;

  button.hidden = false;
  button.addEventListener('click', async () => {
    status.textContent = '';

    try {
      await navigator.clipboard.writeText(link.getAttribute('href').slice(7));
      button.textContent = 'Copiado';
      status.textContent = 'Correo copiado al portapapeles.';
    } catch {
      button.textContent = 'Copiar';
      status.textContent = 'No se pudo copiar. Puedes seleccionar la dirección de correo.';
    }
  });
}

function setupTheme() {
  const button = document.querySelector('#theme-toggle');
  if (!button) return;

  const root = document.documentElement;
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let preferredTheme = root.dataset.theme;
  let transition;

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    button.setAttribute('aria-pressed', String(theme === 'dark'));
  };
  const applySystemTheme = () => applyTheme(systemTheme.matches ? 'dark' : 'light');

  if (preferredTheme === 'light' || preferredTheme === 'dark') applyTheme(preferredTheme);
  else applySystemTheme();
  systemTheme.addEventListener('change', () => {
    if (!preferredTheme) applySystemTheme();
  });

  button.hidden = false;
  button.addEventListener('click', () => {
    if (transition) return;
    preferredTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('portfolio-theme', preferredTheme);
    } catch {
      // The current page still switches themes when storage is unavailable.
    }

    if (reducedMotion.matches || !document.startViewTransition) {
      applyTheme(preferredTheme);
      return;
    }

    const bounds = button.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.style.setProperty('--theme-x', `${x}px`);
    root.style.setProperty('--theme-y', `${y}px`);
    root.style.setProperty('--theme-radius', `${radius}px`);
    root.classList.add('theme-transition');

    transition = document.startViewTransition(() => applyTheme(preferredTheme));
    transition.ready.catch(() => {});
    transition.finished.finally(() => {
      root.classList.remove('theme-transition');
      transition = undefined;
    });
  });

  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) transition?.skipTransition();
  });
}

function setupProjects() {
  const carousel = document.querySelector('#project-carousel');
  const controls = document.querySelector('.project-controls');
  const position = document.querySelector('#project-position');
  const status = document.querySelector('#project-status');
  if (!carousel || !controls || !position || !status) return;

  const projects = [...carousel.children].filter((child) => child.matches('.project'));
  if (!projects.length) return;

  const previous = controls.querySelector('[data-project-step="-1"]');
  const next = controls.querySelector('[data-project-step="1"]');
  const links = document.querySelectorAll('[data-case-link]');
  const carouselLayout = matchMedia('(min-width: 57rem) and (min-height: 42rem)');
  let current = -1;
  let frame = 0;

  const setCurrent = (index) => {
    if (index === current) return;
    projects[current]?.removeAttribute('data-current');
    current = index;
    projects[index].setAttribute('data-current', '');
    for (const link of links) {
      if (link.hash === '#' + projects[index].id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    position.textContent = `${String(index + 1).padStart(2, '0')} / ${String(projects.length).padStart(2, '0')}`;
    previous?.setAttribute('aria-disabled', String(index === 0));
    next?.setAttribute('aria-disabled', String(index === projects.length - 1));
  };

  const trackCurrent = () => {
    frame = 0;
    const guide = carouselLayout.matches
      ? carousel.getBoundingClientRect().top + carousel.clientHeight * 0.45
      : innerHeight * 0.45;
    let best = Infinity;
    let active = 0;
    projects.forEach((project, index) => {
      const { top, bottom } = project.getBoundingClientRect();
      const distance = Math.max(top - guide, guide - bottom, 0);
      if (distance < best) {
        best = distance;
        active = index;
      }
    });
    setCurrent(active);
  };

  const scheduleTracking = () => {
    if (!frame) frame = requestAnimationFrame(trackCurrent);
  };

  const goTo = (index) => {
    const project = projects[index];
    if (!project || index === current) return;
    status.textContent = `Caso ${index + 1} de ${projects.length}: ${project.querySelector('h3').textContent}`;
    const behavior = reducedMotion.matches ? 'instant' : 'smooth';
    if (!carouselLayout.matches) {
      project.scrollIntoView({ block: 'start', behavior });
      return;
    }
    const offset = project.getBoundingClientRect().top - carousel.getBoundingClientRect().top;
    carousel.scrollTo({ top: carousel.scrollTop + offset - carousel.clientTop, behavior });
  };

  carousel.dataset.ready = '';
  controls.hidden = false;
  const linkedProject = projects.findIndex(({ id }) => '#' + id === location.hash);
  if (linkedProject >= 0) {
    projects[linkedProject].scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  trackCurrent();
  carousel.addEventListener('scroll', scheduleTracking, { passive: true });
  window.addEventListener('scroll', () => {
    if (!carouselLayout.matches) scheduleTracking();
  }, { passive: true });
  window.addEventListener('resize', scheduleTracking, { passive: true });
  previous?.addEventListener('click', () => goTo(current - 1));
  next?.addEventListener('click', () => goTo(current + 1));
  carousel.addEventListener('keydown', (event) => {
    if (event.target !== carousel || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const targets = { ArrowUp: current - 1, ArrowDown: current + 1, Home: 0, End: projects.length - 1 };
    if (!Object.hasOwn(targets, event.key) || !projects[targets[event.key]] || targets[event.key] === current) return;
    event.preventDefault();
    goTo(targets[event.key]);
  });
}

function setupMatchReplay() {
  const button = document.querySelector('#replay-match');
  const trace = document.querySelector('#match-trace');
  const status = document.querySelector('#match-status');
  if (!button || !trace || !status) return;

  const stops = [...trace.querySelectorAll('.match-stops > li')];
  let replay = 0;
  let timeline;

  const showStep = (step) => {
    trace.dataset.step = String(step);
    stops.forEach((stop, index) => stop.toggleAttribute('data-passed', index < step));
  };

  const complete = () => {
    timeline = undefined;
    showStep(stops.length);
    status.textContent = 'La otra sesión recibe el evento y ve la ficha bloqueada.';
  };

  button.hidden = false;
  button.addEventListener('click', async () => {
    const run = ++replay;
    timeline?.cancel();
    status.textContent = '';
    showStep(0);
    if (reducedMotion.matches) {
      complete();
      return;
    }

    try {
      const { createTimeline } = await import('./assets/animation.js');
      if (run !== replay) return;
      if (reducedMotion.matches) {
        complete();
        return;
      }
      showStep(1);
      timeline = createTimeline({ autoplay: false })
        .call(() => showStep(2), 300)
        .call(complete, 650);
      timeline.play();
    } catch {
      if (run === replay) complete();
    }
  });

  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches || !timeline) return;
    timeline.cancel();
    complete();
  });
}

setupTheme();
setupProjects();
setupMatchReplay();
setupContact();
