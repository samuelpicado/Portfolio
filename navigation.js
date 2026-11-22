const disclosure = document.querySelector('.side-nav-disclosure');
const desktopNav = matchMedia('(min-width: 61rem) and (min-height: 18rem)');
const motion = matchMedia('(prefers-reduced-motion: no-preference)');
const links = disclosure.querySelector('.side-nav-links');
const glider = links.querySelector('.side-glider');

function syncLayout() {
  disclosure.toggleAttribute('data-docked', desktopNav.matches);
  disclosure.open = desktopNav.matches;
}

syncLayout();
desktopNav.addEventListener('change', syncLayout);

for (const surface of disclosure.querySelectorAll('.side-nav-trigger, .side-nav-panel')) {
  let reflectionFrame = 0;
  let pointerX;
  let pointerY;
  surface.addEventListener('pointermove', event => {
    if (!motion.matches || event.pointerType !== 'mouse') return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (reflectionFrame) return;
    reflectionFrame = requestAnimationFrame(() => {
      reflectionFrame = 0;
      const rect = surface.getBoundingClientRect();
      surface.style.setProperty('--glass-x', `${(pointerX - rect.left) / rect.width * 100}%`);
      surface.style.setProperty('--glass-y', `${(pointerY - rect.top) / rect.height * 100}%`);
    });
  }, { passive: true });

  const clearReflection = () => {
    cancelAnimationFrame(reflectionFrame);
    reflectionFrame = 0;
    surface.style.removeProperty('--glass-x');
    surface.style.removeProperty('--glass-y');
  };
  surface.addEventListener('pointerleave', clearReflection);
  motion.addEventListener('change', clearReflection);
}

document.addEventListener('pointerdown', event => {
  if (!desktopNav.matches && disclosure.open && !disclosure.contains(event.target)) disclosure.open = false;
});

disclosure.addEventListener('click', event => {
  if (!desktopNav.matches && event.target.closest('a')) disclosure.open = false;
});

disclosure.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || desktopNav.matches || !disclosure.open) return;
  disclosure.open = false;
  disclosure.querySelector('summary').focus({ preventScroll: true });
});

const routes = [...links.querySelectorAll('a')].map(link => {
  const section = link.hash === '#inicio' ? document.querySelector('.hero') : document.querySelector(link.hash);
  return { section, link };
});

let activeLink = links.querySelector('[aria-current]');
let frame = 0;
let glide;

function positionGlider(animate = false) {
  if (!disclosure.open || !activeLink) {
    glide?.cancel();
    glider.hidden = true;
    links.removeAttribute('data-glider');
    return;
  }

  const previous = animate && motion.matches && !glider.hidden ? glider.getBoundingClientRect() : null;
  const top = activeLink.offsetTop;
  const height = activeLink.offsetHeight;
  const pose = (y, width = 1, height = 1) => `translateY(${y}px) scale(${width}, ${height})`;

  glide?.cancel();
  glider.style.blockSize = `${height}px`;
  glider.style.transform = pose(top);
  glider.hidden = false;
  links.setAttribute('data-glider', '');
  if (!previous || !height) return;

  // Retarget from the visible lens if another section becomes active mid-glide.
  const start = previous.top + previous.height / 2 - links.getBoundingClientRect().top - height / 2;
  const distance = top - start;
  if (Math.abs(distance) < .5) return;
  const tension = Math.min(Math.abs(distance) / height, 1);
  const overshoot = Math.sign(distance) * (2 + 3 * tension);

  glide = glider.animate([
    { transform: pose(start, previous.width / glider.offsetWidth, previous.height / height), easing: 'cubic-bezier(.2,.65,.24,1)' },
    { transform: pose(start + distance * .57, 1 - .11 * tension, 1 + .32 * tension), offset: .44, easing: 'ease-out' },
    { transform: pose(top + overshoot, 1 + .045 * tension, 1 - .10 * tension), offset: .76, easing: 'ease-out' },
    { transform: pose(top) },
  ], { duration: 460 });
}

function updateRoute() {
  frame = 0;
  const atEnd = scrollY > 0 && scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
  const scene = document.getElementById('inicio').dataset.journeyCurrent;
  const route = scene ? routes.find(({ link }) => link.hash === '#' + (scene === 'mas-proyectos' ? 'proyectos' : scene))
    : atEnd ? routes[routes.length - 1]
    : routes.reduce((visible, entry) => entry.section.getBoundingClientRect().top <= innerHeight * .42 ? entry : visible, null);
  if (!route || route.link === activeLink) return;
  activeLink?.removeAttribute('aria-current');
  activeLink = route.link;
  activeLink.setAttribute('aria-current', 'location');
  positionGlider(true);
}

function scheduleRoute() {
  if (!frame) frame = requestAnimationFrame(updateRoute);
}

updateRoute();
positionGlider();
disclosure.addEventListener('toggle', () => positionGlider());
motion.addEventListener('change', () => positionGlider());
window.addEventListener('scroll', scheduleRoute, { passive: true });
document.addEventListener('journey:scenechange', scheduleRoute);
window.addEventListener('resize', () => {
  positionGlider();
  scheduleRoute();
});
