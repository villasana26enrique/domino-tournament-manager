/**
 * Offline Web Audio API alerts (zero external audio files or codecs required).
 * Safely no-ops in headless environments (e.g. jsdom) or when AudioContext is unavailable.
 */

function getAudioContextConstructor(): (typeof AudioContext) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function playToneSequence(notes: Array<{ freq: number; startSec: number; durationSec: number }>): void {
  const Ctx = getAudioContextConstructor();
  if (!Ctx) return;

  try {
    const ctx = new Ctx();
    const baseTime = ctx.currentTime;

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, baseTime + note.startSec);

      gain.gain.setValueAtTime(0.001, baseTime + note.startSec);
      gain.gain.exponentialRampToValueAtTime(0.22, baseTime + note.startSec + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, baseTime + note.startSec + note.durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(baseTime + note.startSec);
      osc.stop(baseTime + note.startSec + note.durationSec + 0.02);
    }

    const totalMs =
      Math.max(...notes.map((n) => (n.startSec + n.durationSec) * 1000)) + 250;
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, totalMs);
  } catch {
    // Ignore autoplay restrictions or headless audio errors
  }
}

export function playWarningChime(): void {
  playToneSequence([
    { freq: 659.25, startSec: 0, durationSec: 0.22 },
    { freq: 880, startSec: 0.26, durationSec: 0.3 }
  ]);
}

export function playExpiredAlarm(): void {
  playToneSequence([
    { freq: 880, startSec: 0, durationSec: 0.22 },
    { freq: 880, startSec: 0.28, durationSec: 0.22 },
    { freq: 1046.5, startSec: 0.56, durationSec: 0.45 }
  ]);
}
