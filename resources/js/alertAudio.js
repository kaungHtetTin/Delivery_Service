let audioContext = null;
let audioUnlocked = false;

const patterns = {
  rider_assignment: [
    [880, 0.13, 0],
    [1175, 0.13, 0.16],
    [880, 0.16, 0.32],
  ],
  client_delivered: [
    [660, 0.16, 0],
    [880, 0.18, 0.18],
    [1175, 0.22, 0.38],
  ],
};

function context() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) {
    return null;
  }

  audioContext ||= new AudioContext();

  return audioContext;
}

export async function unlockAlertAudio() {
  const ctx = context();

  if (!ctx) {
    return false;
  }

  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    audioUnlocked = ctx.state === "running";
  } catch {
    audioUnlocked = false;
  }

  return audioUnlocked;
}

export async function playWorkflowAlert(kind) {
  const ctx = context();
  const pattern = patterns[kind];

  if (!ctx || !pattern) {
    vibrate(kind);
    return false;
  }

  await unlockAlertAudio();

  if (!audioUnlocked) {
    vibrate(kind);
    return false;
  }

  const startedAt = ctx.currentTime + 0.02;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.0001, startedAt);
  masterGain.gain.exponentialRampToValueAtTime(0.23, startedAt + 0.02);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.86);
  masterGain.connect(ctx.destination);

  pattern.forEach(([frequency, duration, offset]) => {
    const oscillator = ctx.createOscillator();
    const noteGain = ctx.createGain();
    const noteStart = startedAt + offset;
    const noteEnd = noteStart + duration;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    noteGain.gain.setValueAtTime(0.0001, noteStart);
    noteGain.gain.exponentialRampToValueAtTime(1, noteStart + 0.01);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    oscillator.connect(noteGain);
    noteGain.connect(masterGain);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.02);
  });

  vibrate(kind);
  return true;
}

function vibrate(kind) {
  if (typeof navigator === "undefined" || !navigator.vibrate) {
    return;
  }

  navigator.vibrate(kind === "rider_assignment" ? [160, 80, 160] : [80, 50, 120]);
}
