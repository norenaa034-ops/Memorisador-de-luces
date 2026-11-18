// Web Audio API synthesizer for Simón Dice (zero external audio files)

export type PadId = 'green' | 'red' | 'yellow' | 'blue';

export const PAD_FREQUENCIES: Record<PadId, number> = {
  green: 329.63,  // Mi 4 (E4)
  red: 392.0,     // Sol 4 (G4)
  yellow: 493.88, // Si 4 (B4)
  blue: 659.25,   // Mi 5 (E5)
};

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playPadTone(pad: PadId, durationMs = 280, enabled = true): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const freq = PAD_FREQUENCIES[pad];
  const now = ctx.currentTime;
  const durationSec = Math.max(0.12, durationMs / 1000);

  // Primary sine/triangle blend for warm, clear arcade synth tone
  const oscMain = ctx.createOscillator();
  const oscHarmonic = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscMain.type = 'triangle';
  oscMain.frequency.setValueAtTime(freq, now);

  oscHarmonic.type = 'sine';
  oscHarmonic.frequency.setValueAtTime(freq * 2, now);

  const harmonicGain = ctx.createGain();
  harmonicGain.gain.setValueAtTime(0.18, now);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
  gainNode.gain.setValueAtTime(0.14, now + durationSec * 0.65);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  oscMain.connect(gainNode);
  oscHarmonic.connect(harmonicGain);
  harmonicGain.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscMain.start(now);
  oscHarmonic.start(now);
  oscMain.stop(now + durationSec + 0.03);
  oscHarmonic.stop(now + durationSec + 0.03);
}

export function playErrorBuzzer(enabled = true): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(145, now);
  osc1.frequency.linearRampToValueAtTime(98, now + 0.42);

  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(152, now);
  osc2.frequency.linearRampToValueAtTime(102, now + 0.42);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.13, now + 0.025);
  gain.gain.setValueAtTime(0.11, now + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.5);
  osc2.stop(now + 0.5);
}

export function playRoundClearChime(enabled = true): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, idx) => {
    const start = ctx.currentTime + idx * 0.06;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.07, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + 0.18);
  });
}
