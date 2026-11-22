const recording = new URL('./assets/welcome-electric.mp3', import.meta.url);

// The main transients in welcome-electric.mp3, measured from the start of playback.
export const sparkCues = [.17, .25, .38, .55];

export function loadWelcomeSound(signal) {
  return fetch(recording, { signal })
    .then(response => response.ok ? response.arrayBuffer() : null)
    .catch(() => null);
}

function outputTime(context, audioTime) {
  const timestamp = context.getOutputTimestamp?.();
  if (timestamp?.performanceTime > 0) {
    return timestamp.performanceTime + (audioTime - timestamp.contextTime) * 1000;
  }
  return performance.now() + (audioTime - context.currentTime +
    (context.baseLatency || 0) + (context.outputLatency || 0)) * 1000;
}

export function playWelcomeSound({ recordingBytes, startFlight, signal }) {
  if (signal?.aborted) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    startFlight(performance.now());
    return;
  }

  let context;
  try {
    context = new AudioContext({ latencyHint: 'interactive' });
  } catch {
    startFlight(performance.now());
    return;
  }

  let closed = false;
  let timeout = setTimeout(startSilent, 350);
  signal?.addEventListener('abort', close, { once: true });

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timeout);
    signal?.removeEventListener('abort', close);
    if (context.state !== 'closed') context.close().catch(() => {});
  }

  function startSilent() {
    if (closed) return;
    close();
    startFlight(performance.now());
  }

  async function start() {
    if (context.state !== 'running') await context.resume();
    if (closed) return;
    if (context.state !== 'running') return startSilent();
    const bytes = await recordingBytes;
    if (closed) return;
    if (!bytes) return startSilent();
    const buffer = await context.decodeAudioData(bytes);
    if (closed) return;

    const source = context.createBufferSource();
    const volume = context.createGain();
    volume.gain.value = .55;
    source.buffer = buffer;
    source.connect(volume);
    volume.connect(context.destination);
    source.onended = close;
    const playbackStart = context.currentTime + .035;
    const startedAt = Math.max(performance.now(), outputTime(context, playbackStart));
    source.start(playbackStart, 0);
    clearTimeout(timeout);
    timeout = setTimeout(close, startedAt - performance.now() + buffer.duration * 1000 + 150);
    startFlight(startedAt);
  }

  start().catch(startSilent);
}
