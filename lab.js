(() => {
  const plot = document.getElementById('lab-plot');
  const slider = document.getElementById('lab-noise');
  const noiseValue = document.getElementById('lab-noise-value');
  const r2Value = document.getElementById('lab-r2');
  const maeValue = document.getElementById('lab-mae');
  const status = document.getElementById('lab-update');

  if (!plot || !slider || !noiseValue || !r2Value || !maeValue || !status) return;

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const bounds = { left: 50, right: 596, top: 40, bottom: 270 };
  const ticks = [0, 2, 4, 6, 8, 10];
  const decimal = new Intl.NumberFormat('es', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function svgElement(tag, attributes = {}, content) {
    const element = document.createElementNS(svgNamespace, tag);
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, value);
    }
    if (content !== undefined) element.textContent = content;
    return element;
  }

  const xPosition = x => bounds.left + x / 10 * (bounds.right - bounds.left);
  const yPosition = y => bounds.bottom - y / 10 * (bounds.bottom - bounds.top);

  // Reuse the same sample and perturbations at every slider position.
  let seed = 1729;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  const sample = Array.from({ length: 32 }, (_, index) => {
    const x = 0.60 + index * 8.8 / 31 + (random() - 0.5) * 0.20;
    return { x, trend: 2.15 + 0.57 * x, disturbance: random() * 2 - 1 };
  });

  function fitLine(observations) {
    const count = observations.length;
    const meanX = observations.reduce((sum, point) => sum + point.x, 0) / count;
    const meanY = observations.reduce((sum, point) => sum + point.y, 0) / count;
    let covariance = 0;
    let varianceX = 0;
    let totalSquares = 0;

    for (const { x, y } of observations) {
      const centeredX = x - meanX;
      const centeredY = y - meanY;
      covariance += centeredX * centeredY;
      varianceX += centeredX ** 2;
      totalSquares += centeredY ** 2;
    }

    const slope = covariance / varianceX;
    const intercept = meanY - slope * meanX;
    const predict = x => intercept + slope * x;
    let residualSquares = 0;
    let absoluteError = 0;

    for (const { x, y } of observations) {
      const error = y - predict(x);
      residualSquares += error ** 2;
      absoluteError += Math.abs(error);
    }

    return {
      predict,
      r2: 1 - residualSquares / totalSquares,
      mae: absoluteError / count,
    };
  }

  const title = svgElement('title', { id: 'lab-plot-title' }, 'Dispersión y ajuste lineal de datos sintéticos');
  const description = svgElement('desc', { id: 'lab-plot-description' });
  plot.setAttribute('aria-labelledby', title.id);
  plot.setAttribute('aria-describedby', description.id);

  const grid = svgElement('g', { class: 'lab-plot-grid' });
  const axes = svgElement('g', { class: 'lab-plot-axes' });
  for (const tick of ticks) {
    const x = xPosition(tick);
    const y = yPosition(tick);
    grid.append(
      svgElement('line', { x1: x, x2: x, y1: bounds.top, y2: bounds.bottom }),
      svgElement('line', { x1: bounds.left, x2: bounds.right, y1: y, y2: y }),
    );
    axes.append(
      svgElement('text', { x, y: 295, 'text-anchor': 'middle' }, tick),
      svgElement('text', { x: 39, y, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, tick),
    );
  }

  axes.append(
    svgElement('path', { d: `M ${bounds.left} ${bounds.top} V ${bounds.bottom} H ${bounds.right}` }),
    svgElement('text', { class: 'lab-plot-variable', x: 39, y: 20, 'text-anchor': 'end' }, 'y'),
    svgElement('text', { class: 'lab-plot-variable', x: 323, y: 317, 'text-anchor': 'middle' }, 'x'),
  );

  const legend = svgElement('g', { class: 'lab-plot-legend' });
  legend.append(
    svgElement('circle', { cx: 58, cy: 15, r: 4 }),
    svgElement('text', { x: 71, y: 20 }, 'Observaciones'),
    svgElement('line', { x1: 322, x2: 349, y1: 15, y2: 15 }),
    svgElement('text', { x: 360, y: 20 }, 'Ajuste lineal'),
  );

  const residuals = svgElement('g', { class: 'lab-plot-residuals' });
  const fittedLine = svgElement('line', { class: 'lab-plot-fit', x1: bounds.left, x2: bounds.right });
  const points = svgElement('g');
  const marks = sample.map(({ x }) => {
    const cx = xPosition(x);
    const point = svgElement('circle', { class: 'lab-plot-point', cx, r: 4 });
    const residual = svgElement('line', { x1: cx, x2: cx });
    points.append(point);
    residuals.append(residual);
    return { point, residual };
  });

  plot.replaceChildren(title, description, grid, axes, legend, residuals, fittedLine, points);
  noiseValue.setAttribute('aria-live', 'off');

  function update(announce = false) {
    const noise = slider.valueAsNumber;
    const spread = 2.25 * noise / 100;
    const observations = sample.map(({ x, trend, disturbance }) => ({
      x,
      y: trend + disturbance * spread,
    }));
    const result = fitLine(observations);

    fittedLine.setAttribute('y1', yPosition(result.predict(0)));
    fittedLine.setAttribute('y2', yPosition(result.predict(10)));
    observations.forEach(({ x, y }, index) => {
      const { point, residual } = marks[index];
      const cy = yPosition(y);
      point.setAttribute('cy', cy);
      residual.setAttribute('y1', cy);
      residual.setAttribute('y2', yPosition(result.predict(x)));
    });

    const percentage = `${noise}\u00a0%`;
    slider.style.setProperty('--lab-noise', `${noise}%`);
    slider.setAttribute('aria-valuetext', percentage);
    noiseValue.value = percentage;
    r2Value.textContent = decimal.format(result.r2);
    maeValue.textContent = decimal.format(result.mae);
    const summary = `Ruido del ${percentage}. R² de ${r2Value.textContent}. Error medio absoluto de ${maeValue.textContent} unidades.`;
    description.textContent = `${sample.length} observaciones en ejes de 0 a 10. ${summary}`;
    if (announce) status.textContent = summary;
  }

  slider.addEventListener('input', () => update());
  slider.addEventListener('change', () => update(true));
  update();
  slider.closest('.lab-grid')?.removeAttribute('hidden');
})();
