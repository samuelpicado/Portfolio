const colors = ['violet', 'coral', 'mint'];
const makeSvg = tag => document.createElementNS('http://www.w3.org/2000/svg', tag);

// In the static layout the ribbon marks the middle sections; both fields
// remain closed compositions.
function wirePath(stops) {
  let path = 'M' + stops[0].join(' ');
  for (let i = 1; i < stops.length - 1; i++) {
    const [x, y] = stops[i];
    const [px, py] = stops[i - 1];
    const [nx, ny] = stops[i + 1];
    const before = Math.hypot(px - x, py - y);
    const after = Math.hypot(nx - x, ny - y);
    if (!before || !after) continue;
    const cut = Math.min(38, before * .45, after * .45);
    const entry = [x + (px - x) * cut / before, y + (py - y) * cut / before];
    const exit = [x + (nx - x) * cut / after, y + (ny - y) * cut / after];
    path += 'L' + entry.join(' ') + 'Q' + [x, y, ...exit].join(' ');
  }
  return path + 'L' + stops.at(-1).join(' ');
}

export function mountStaticSignalRoute(world) {
  const opening = world.querySelector('#signal-field');
  const contact = world.querySelector('#contact-field');
  const work = world.querySelector('#proyectos');
  const list = world.querySelector('.project-index-list');
  const profile = world.querySelector('#perfil');
  if (!opening || !contact || !work || !list || !profile) return () => {};

  const layer = makeSvg('svg');
  layer.classList.add('static-wiring');
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('focusable', 'false');
  const wires = colors.map(color => {
    const group = makeSvg('g');
    group.classList.add('static-' + color);
    const wire = makeSvg('path');
    wire.classList.add('static-strand');
    group.append(wire);
    layer.append(group);
    return wire;
  });
  const taps = Array.from(list.querySelectorAll('li > a'), (link, i) => {
    const branch = makeSvg('path');
    const pad = makeSvg('circle');
    pad.setAttribute('r', '2');
    const strand = i % colors.length;
    wires[strand].parentNode.append(branch, pad);
    return { link, strand, branch, pad };
  });
  world.dataset.staticCircuit = '';
  world.append(layer);
  let frame = 0;
  let mounted = true;

  function measure() {
    frame = 0;
    const bounds = layer.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    // WELCOME can scale a containing element. Work in unscaled CSS pixels.
    const width = world.clientWidth;
    const scale = bounds.width / width;
    function box(node) {
      const r = node.getBoundingClientRect();
      const x = (r.left - bounds.left) / scale, y = (r.top - bounds.top) / scale;
      const w = r.width / scale, h = r.height / scale;
      return { x, y, w, h, right: x + w, bottom: y + h };
    }
    const directory = box(list);
    const startWork = box(work).y;
    const endProfile = box(profile).bottom;
    const gap = Math.max(4, width - directory.right);
    const rail = width - Math.min(30, gap * .43);
    const spread = Math.min(5, gap * .15);
    const description = box(list.querySelector('li > div'));
    // On a stacked list the right gutter stays clear; short taps turn into
    // the whitespace between each description and its repository link.
    const stacked = matchMedia('(max-width: 48rem)').matches;
    const firstLink = taps.length && box(taps[0].link);
    const lane = !stacked && firstLink ? (description.right + firstLink.x) / 2 : rail;
    wires.forEach((wire, i) => {
      const offset = (i - 1) * spread;
      const edge = rail + offset, inner = lane + offset;
      const outer = edge - gap * .24;
      const shoulder = edge - Math.min(115, width * .14);
      const listIn = directory.y + 6 - offset;
      const listOut = directory.bottom + 14 + offset;
      wire.setAttribute('d', wirePath([
        [edge, startWork + 35 - offset], [outer, startWork + 66 - offset],
        [outer, listIn], [inner, listIn], [inner, listOut], [edge, listOut],
        [edge, endProfile - 87 + offset], [shoulder, endProfile - 37 + offset],
      ]));
    });
    taps.forEach(({ link, strand, branch, pad }) => {
      const target = box(link);
      const startX = lane + (strand - 1) * spread;
      const endX = stacked ? target.x + Math.min(22, target.w * .35) : target.x - 7;
      const y = stacked ? target.y - 6 : target.y + target.h / 2;
      branch.setAttribute('d', 'M' + startX + ' ' + y + 'H' + endX);
      pad.setAttribute('cx', endX);
      pad.setAttribute('cy', y);
    });
  }

  function schedule() {
    if (mounted && !frame) frame = requestAnimationFrame(measure);
  }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  [world, ...world.querySelectorAll('[data-journey-scene]'), opening, list, contact]
    .forEach(node => observer?.observe(node));
  window.addEventListener('resize', schedule);
  world.addEventListener('load', schedule, true);
  document.fonts?.ready.then(schedule);
  measure();
  return () => {
    mounted = false;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener('resize', schedule);
    world.removeEventListener('load', schedule, true);
    layer.remove();
    delete world.dataset.staticCircuit;
  };
}
