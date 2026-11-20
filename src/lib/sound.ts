// 효과음 (파일 없이 Web Audio로 직접 만들어요)
let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem('baduk-muted') === '1';
} catch {
  /* 저장소를 못 써도 괜찮아요 */
}

export const isMuted = () => muted;
export function setMuted(v: boolean) {
  muted = v;
  try {
    localStorage.setItem('baduk-muted', v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.2) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export const sounds = {
  stone: () => {
    tone(820, 0, 0.08, 'triangle', 0.25);
    tone(420, 0, 0.06, 'sine', 0.15);
  },
  capture: () => [660, 880, 1100].forEach((f, i) => tone(f, i * 0.08, 0.18, 'triangle', 0.18)),
  correct: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.1, 0.2, 'sine', 0.2)),
  wrong: () => tone(220, 0, 0.25, 'square', 0.08),
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25, 'triangle', 0.2)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.18, 0.3, 'sine', 0.15)),
};
