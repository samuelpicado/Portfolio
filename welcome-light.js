const vertexShader = `#version 300 es
out vec2 vUV;

void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

const volumeShader = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragment;
uniform sampler2D uMask;
uniform sampler2D uNoise;
uniform vec2 uMaskBand;
uniform vec2 uLight;
uniform float uAspect;

const int marchSteps = 36;
const int lightTaps = 5;

vec2 toUV(vec2 point) {
  return vec2(point.x / uAspect, point.y) + 0.5;
}

float transmission(vec2 point, vec2 source, float jitter) {
  vec2 lightUV = toUV(source);
  if (min(vUV.y, lightUV.y) > uMaskBand.y || max(vUV.y, lightUV.y) < uMaskBand.x) {
    return 1.0;
  }

  vec2 rayUV = lightUV - vUV;
  int first = 0;
  int end = marchSteps;
  if (abs(rayUV.y) > 0.0001) {
    vec2 bounds = (uMaskBand - vUV.y) / rayUV.y * float(marchSteps) - jitter;
    first = int(clamp(ceil(min(bounds.x, bounds.y)), 0.0, float(marchSteps)));
    end = int(clamp(floor(max(bounds.x, bounds.y)) + 1.0, 0.0, float(marchSteps)));
  }

  vec2 stepUV = rayUV / float(marchSteps);
  vec2 sampleUV = vUV + stepUV * (float(first) + jitter);
  float thickness = 0.0;
  for (int step = first; step < end; step++) {
    thickness += texture(uMask, sampleUV).g;
    sampleUV += stepUV;
  }
  return exp(-thickness * length(source - point) * (26.0 / float(marchSteps)));
}

void main() {
  vec2 point = (vUV - 0.5) * vec2(uAspect, 1.0);
  float noise = texture(uNoise, gl_FragCoord.xy / 64.0).r;
  float through = 0.0;
  float totalWeight = 0.0;
  for (int tap = 0; tap < lightTaps; tap++) {
    float offset = float(tap) / float(lightTaps - 1) - 0.5;
    float weight = 1.0 - abs(offset) * 1.2;
    vec2 source = uLight + vec2(0.0, offset * 0.28);
    through += weight * transmission(point, source, fract(noise + float(tap) * 0.618));
    totalWeight += weight;
  }
  fragment = vec4(through / totalWeight, 0.0, 0.0, 1.0);
}`;

const compositeShader = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragment;
uniform sampler2D uMask;
uniform sampler2D uNoise;
uniform sampler2D uVolume;
uniform vec2 uRes;
uniform vec2 uLight;
uniform float uAspect;
uniform float uTime;
uniform float uReveal;

void main() {
  vec2 point = (vUV - 0.5) * vec2(uAspect, 1.0);
  vec2 toLight = uLight - point;
  float distanceToLight = length(toLight);
  float radius = max(distanceToLight - 0.03, 0.0);
  float falloff = exp(-radius * 1.8) / (1.0 + radius * radius * 24.0);
  vec3 mask = texture(uMask, vUV).rgb;
  float through = texture(uVolume, vUV).r;
  vec2 noiseOffset = vec2(11.0, 23.0) * floor(uTime * 36.0);
  float noise = texture(uNoise, (gl_FragCoord.xy + noiseOffset) / 64.0).r;

  vec2 pixel = 1.0 / uRes;
  vec2 bevel = max(pixel, vec2(0.004 / uAspect, 0.004));
  vec2 bevelGradient = vec2(
    texture(uMask, vUV + vec2(bevel.x, 0.0)).g - texture(uMask, vUV - vec2(bevel.x, 0.0)).g,
    texture(uMask, vUV + vec2(0.0, bevel.y)).g - texture(uMask, vUV - vec2(0.0, bevel.y)).g
  );
  vec2 rimGradient = vec2(
    texture(uMask, vUV + vec2(pixel.x, 0.0)).r - texture(uMask, vUV - vec2(pixel.x, 0.0)).r,
    texture(uMask, vUV + vec2(0.0, pixel.y)).r - texture(uMask, vUV - vec2(0.0, pixel.y)).r
  );
  float bevelEdge = clamp(length(bevelGradient) * 1.7, 0.0, 1.0);
  float rim = min(length(rimGradient), 1.0);
  float facing = clamp(dot(-rimGradient, toLight) / max(length(rimGradient) * distanceToLight, 0.0001), 0.0, 1.0);
  vec3 tint = mix(vec3(1.0, 0.94, 0.79), vec3(0.66, 0.31, 0.14), smoothstep(0.13, 1.2, radius));
  vec3 air = tint * (falloff * (0.014 + 0.52 * pow(through, 1.7)));
  vec3 slab = vec3(0.0013, 0.0011, 0.0009) + tint * (falloff * (0.048 + 0.033 * mask.g));
  vec3 color = mix(air, slab, mask.r * 0.94);
  color += tint * (mask.b * (0.002 + falloff * 0.028) + bevelEdge * (0.005 + falloff * 0.16));
  color += tint * rim * (0.003 + falloff * (0.024 + facing * facing * 0.30));
  color = pow(color / (1.0 + color * 0.8), vec3(1.0 / 2.2));

  float vignette = mix(1.0, 0.64, smoothstep(0.17, 0.69, length(vUV - 0.5)));
  float grain = (noise - 0.5) * 0.028 * smoothstep(0.012, 0.13, max(color.r, color.g));
  vec3 dark = vec3(1.0 / 255.0);
  fragment = vec4(max(dark, (color * vignette + grain) * uReveal), 1.0);
}`;

const word = 'WELCOME';
const font = '500 48px Bricolage';
const noiseSize = 64;

export function layoutWelcomeWord(context, width, height) {
  context.font = font;
  context.letterSpacing = '0px';
  const referenceWidth = context.measureText(word).width;
  const fontSize = Math.min(height * .42, width * .34, width * .91 * 48 / referenceWidth);
  context.font = `500 ${fontSize}px Bricolage, sans-serif`;
  context.letterSpacing = `${fontSize * -.02}px`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  return { word, fontSize, baseline: height * .5 + fontSize * .04 };
}

function createProgram(gl, fragmentSource) {
  const program = gl.createProgram();
  if (!program) return null;

  for (const [type, source] of [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, fragmentSource]]) {
    const shader = gl.createShader(type);
    if (!shader) {
      gl.deleteProgram(program);
      return null;
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      gl.deleteProgram(program);
      return null;
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }

  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
}

function makeNoise() {
  let seed = 562019;
  const samples = Float32Array.from({ length: noiseSize ** 2 }, () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 2 ** 32;
  });
  const sample = (x, y) => samples[((y + noiseSize) % noiseSize) * noiseSize + (x + noiseSize) % noiseSize];
  // Rank a wrapped high-pass field so jitter stays uniform without low-frequency clumps.
  const ranked = Array.from(samples, (value, index) => {
    const x = index % noiseSize;
    const y = Math.floor(index / noiseSize);
    const neighborhood = sample(x - 1, y) + sample(x + 1, y) + sample(x, y - 1) + sample(x, y + 1);
    return { index, value: value - neighborhood / 4 };
  }).sort((a, b) => a.value - b.value);
  const pixels = new Uint8Array(samples.length);
  ranked.forEach(({ index }, rank) => { pixels[index] = Math.floor(rank * 256 / samples.length); });
  return pixels;
}

function makeMask(width, height) {
  const createContext = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas.getContext('2d');
  };
  const glyph = createContext();
  const tint = createContext();
  const mask = createContext();
  if (!glyph || !tint || !mask || !('filter' in mask)) return null;

  const { baseline } = layoutWelcomeWord(glyph, width, height);
  glyph.fillStyle = '#fff';
  glyph.fillText(word, width * .5, baseline);

  mask.fillStyle = '#000';
  mask.fillRect(0, 0, width, height);
  mask.globalCompositeOperation = 'lighter';
  for (const [color, blur] of [['#f00', 0], ['#0f0', .006], ['#00f', .03]]) {
    tint.clearRect(0, 0, width, height);
    tint.drawImage(glyph.canvas, 0, 0);
    tint.globalCompositeOperation = 'source-in';
    tint.fillStyle = color;
    tint.fillRect(0, 0, width, height);
    tint.globalCompositeOperation = 'source-over';
    mask.filter = blur ? `blur(${height * blur}px)` : 'none';
    mask.drawImage(tint.canvas, 0, 0);
  }

  const metrics = glyph.measureText(word);
  const blurMargin = .027;
  return {
    canvas: mask.canvas,
    minY: 1 - (baseline + metrics.actualBoundingBoxDescent) / height - blurMargin,
    maxY: 1 - (baseline - metrics.actualBoundingBoxAscent) / height + blurMargin,
  };
}

export async function startWelcomeLight(canvas, { signal, onReveal } = {}) {
  if (signal?.aborted || typeof ResizeObserver === 'undefined') return null;
  try {
    await document.fonts.load(font, word);
  } catch {
    return null;
  }
  if (signal?.aborted) return null;

  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
  });
  if (!gl) return null;

  const listeners = new AbortController();
  const program = createProgram(gl, compositeShader);
  const volumeProgram = createProgram(gl, volumeShader);
  const maskTexture = gl.createTexture();
  const noiseTexture = gl.createTexture();
  const volumeTexture = gl.createTexture();
  const volumeBuffer = gl.createFramebuffer();
  const mesh = gl.createVertexArray();
  const releaseContext = gl.getExtension('WEBGL_lose_context');
  const surface = canvas.closest('dialog') || canvas;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let observer;
  let cleanupDone = false;
  let frame = 0;
  let previousTime;
  let elapsed = 0;
  let aspect;
  let lightX = .06;
  let lightY = .16;
  let targetX = lightX;
  let targetY = lightY;
  let lastInteraction = 0;
  let volumeLightX = Infinity;
  let volumeLightY = Infinity;

  function cleanup() {
    if (cleanupDone) return;
    cleanupDone = true;
    listeners.abort();
    observer?.disconnect();
    cancelAnimationFrame(frame);
    gl.deleteTexture(maskTexture);
    gl.deleteTexture(noiseTexture);
    gl.deleteTexture(volumeTexture);
    gl.deleteFramebuffer(volumeBuffer);
    gl.deleteVertexArray(mesh);
    gl.deleteProgram(program);
    gl.deleteProgram(volumeProgram);
    if (!gl.isContextLost()) releaseContext?.loseContext();
  }

  if (!program || !volumeProgram || !maskTexture || !noiseTexture || !volumeTexture || !volumeBuffer || !mesh) {
    cleanup();
    return null;
  }

  const uniformsFor = (currentProgram, names) =>
    Object.fromEntries(names.map(name => [name, gl.getUniformLocation(currentProgram, name)]));
  const common = ['uMask', 'uNoise', 'uLight', 'uAspect'];
  const uniforms = uniformsFor(program, [...common, 'uRes', 'uTime', 'uVolume', 'uReveal']);
  const volumeUniforms = uniformsFor(volumeProgram, [...common, 'uMaskBand']);
  gl.bindVertexArray(mesh);
  gl.useProgram(volumeProgram);
  gl.uniform1i(volumeUniforms.uMask, 0);
  gl.uniform1i(volumeUniforms.uNoise, 1);
  gl.useProgram(program);
  gl.uniform1i(uniforms.uMask, 0);
  gl.uniform1i(uniforms.uNoise, 1);
  gl.uniform1i(uniforms.uVolume, 2);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, noiseSize, noiseSize, 0, gl.RED, gl.UNSIGNED_BYTE, makeNoise());

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, maskTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, volumeTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.bindFramebuffer(gl.FRAMEBUFFER, volumeBuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, volumeTexture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  let volumeWidth;
  let volumeHeight;

  function resize() {
    const density = Math.min(devicePixelRatio, 1.25);
    const { width, height } = surface.getBoundingClientRect();
    if (!width || !height) return false;
    const drawWidth = Math.max(1, Math.round(width * density));
    const drawHeight = Math.max(1, Math.round(height * density));
    if (aspect && canvas.width === drawWidth && canvas.height === drawHeight) return true;
    const mask = makeMask(drawWidth, drawHeight);
    if (!mask) return false;

    canvas.width = drawWidth;
    canvas.height = drawHeight;
    aspect = drawWidth / drawHeight;
    // Shadows are low-frequency. Keep the glyphs, bevels and grain at the display resolution.
    volumeWidth = Math.max(1, Math.round(drawWidth / 3));
    volumeHeight = Math.max(1, Math.round(drawHeight / 3));
    volumeLightX = Infinity;

    gl.useProgram(program);
    gl.uniform2f(uniforms.uRes, drawWidth, drawHeight);
    gl.uniform1f(uniforms.uAspect, aspect);
    gl.useProgram(volumeProgram);
    gl.uniform1f(volumeUniforms.uAspect, aspect);
    gl.uniform2f(volumeUniforms.uMaskBand, mask.minY, mask.maxY);
    gl.activeTexture(gl.TEXTURE0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, mask.canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.activeTexture(gl.TEXTURE2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, volumeWidth, volumeHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, volumeBuffer);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return complete;
  }

  function render(now) {
    const delta = previousTime === undefined ? 0 : (now - previousTime) / 1000;
    previousTime = now;
    elapsed += delta;
    const reduced = reducedMotion.matches;
    const idle = reduced ? 0 : Math.min(1, Math.max(0, (elapsed - lastInteraction - 4) / 6));
    const follow = 1 - Math.exp(-(reduced ? 30 : 3.2) * Math.min(delta, .05));
    lightX += (targetX + Math.sin(elapsed * .23) * .22 * idle - lightX) * follow;
    lightY += (targetY + Math.sin(elapsed * .17 + 1.3) * .12 * idle - lightY) * follow;
    // Subpixel changes only affect the full-resolution composite until the shadow moves perceptibly.
    if (Math.max(Math.abs(lightX - volumeLightX), Math.abs(lightY - volumeLightY)) * canvas.height > .5) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, volumeBuffer);
      gl.viewport(0, 0, volumeWidth, volumeHeight);
      gl.useProgram(volumeProgram);
      gl.uniform2f(volumeUniforms.uLight, lightX, lightY);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      volumeLightX = lightX;
      volumeLightY = lightY;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.uniform2f(uniforms.uLight, lightX, lightY);
    gl.uniform1f(uniforms.uTime, elapsed);
    const reveal = reduced ? 1 : Math.min(1, elapsed / 1.6) ** 2;
    gl.uniform1f(uniforms.uReveal, reveal);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    onReveal?.(reveal);
  }

  function tick(now) {
    frame = 0;
    if (cleanupDone || document.hidden) return;
    render(now);
    frame = requestAnimationFrame(tick);
  }

  function pointAt(event) {
    const bounds = surface.getBoundingClientRect();
    targetX = ((event.clientX - bounds.left) / bounds.width - .5) * aspect;
    targetY = .5 - (event.clientY - bounds.top) / bounds.height;
    lastInteraction = elapsed;
  }

  try {
    if (!resize()) {
      cleanup();
      return null;
    }
    render(performance.now());
    if (gl.getError() !== gl.NO_ERROR || gl.isContextLost()) {
      cleanup();
      return null;
    }
  } catch {
    cleanup();
    return null;
  }

  observer = new ResizeObserver(() => {
    if (!resize()) cleanup();
  });
  observer.observe(surface);
  const options = { passive: true, signal: listeners.signal };
  surface.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch') pointAt(event);
  }, options);
  surface.addEventListener('pointerdown', pointAt, options);
  surface.addEventListener('touchmove', event => {
    if (event.touches[0]) pointAt(event.touches[0]);
  }, options);
  canvas.addEventListener('webglcontextlost', cleanup, options);
  window.addEventListener('pagehide', cleanup, options);
  signal?.addEventListener('abort', cleanup, { once: true, signal: listeners.signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = undefined;
    } else if (!frame) {
      frame = requestAnimationFrame(tick);
    }
  }, options);
  if (!document.hidden) frame = requestAnimationFrame(tick);
  return cleanup;
}
