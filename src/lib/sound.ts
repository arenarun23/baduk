// 효과음 (소리 파일 없이 Web Audio로 직접 만들어요)
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let comp: DynamicsCompressorNode | null = null;
let noiseBuf: AudioBuffer | null = null;
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
  if (!v) sounds.tap();
}

/** 효과음·배경 음악이 함께 쓰는 오디오 (처음 부를 때 만듦). out = 소리 찢어짐을 막는 압축기 */
export function getAudio(): { a: AudioContext; out: AudioNode } | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      // 큰 소리가 겹쳐도 찢어지지 않게
      comp = ctx.createDynamicsCompressor();
      comp.connect(ctx.destination);
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(comp);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return { a: ctx, out: comp! };
  } catch {
    return null;
  }
}

function audio(): { a: AudioContext; out: GainNode } | null {
  if (muted) return null;
  const g = getAudio();
  return g ? { a: g.a, out: master! } : null;
}

function noise(a: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  noiseBuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  /** 끝날 때 주파수 (미끄러지는 소리) */
  slideTo?: number;
  attack?: number;
}

function tone(freq: number, start: number, dur: number, opts: ToneOpts = {}) {
  const ac = audio();
  if (!ac) return;
  const { a, out } = ac;
  const { type = 'sine', vol = 0.2, slideTo, attack = 0.005 } = opts;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** 종소리 같은 맑은 음 (배음 섞기) */
function bell(freq: number, start: number, dur = 0.6, vol = 0.18) {
  tone(freq, start, dur, { vol });
  tone(freq * 2, start, dur * 0.6, { vol: vol * 0.35 });
  tone(freq * 3.01, start, dur * 0.3, { vol: vol * 0.15 });
}

/** 짧은 잡음 (나무 부딪히는 소리, 바람 소리) */
function burst(start: number, dur: number, filterFreq: number, q: number, vol: number, sweepTo?: number) {
  const ac = audio();
  if (!ac) return;
  const { a, out } = ac;
  const t = a.currentTime + start;
  const src = a.createBufferSource();
  src.buffer = noise(a);
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(filterFreq, t);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  filter.Q.value = q;
  const gain = a.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5, E6 = 1318.5, G6 = 1568;

export const sounds = {
  /** 바둑돌 놓는 "딱!" (AI 돌은 조금 낮게) */
  stone: (ai = false) => {
    const p = ai ? 0.85 : 1;
    burst(0, 0.05, 2600 * p, 3, 0.9);
    burst(0, 0.12, 900 * p, 2, 0.35);
    tone(190 * p, 0, 0.09, { vol: 0.35, slideTo: 120 * p });
  },
  /** 돌을 잡았을 때: 뿅뿅 + 반짝 */
  capture: (count = 1) => {
    const n = Math.min(count, 5);
    for (let k = 0; k < n; k++) tone(500 + k * 120, 0.08 + k * 0.07, 0.12, { type: 'triangle', vol: 0.2, slideTo: 1400 });
    const s = 0.12 + n * 0.07;
    [E6, G6, C6 * 2].forEach((f, i) => bell(f, s + i * 0.06, 0.35, 0.08));
  },
  /** 내 돌이 잡혔을 때: 또르르 */
  lost: (count = 1) => {
    const n = Math.min(count, 5);
    for (let k = 0; k < n; k++) tone(700 - k * 60, 0.08 + k * 0.08, 0.14, { type: 'triangle', vol: 0.15, slideTo: 300 });
  },
  /** 단수 경고: 삐뽀 */
  atari: () => {
    tone(880, 0, 0.14, { type: 'triangle', vol: 0.14 });
    tone(660, 0.16, 0.18, { type: 'triangle', vol: 0.14 });
  },
  /** 잡을 기회: 두근 */
  chance: () => {
    tone(G5, 0, 0.1, { type: 'triangle', vol: 0.1 });
    tone(C6, 0.1, 0.16, { type: 'triangle', vol: 0.12 });
  },
  /** 정답: 딩동댕 */
  correct: () => {
    bell(C5, 0, 0.5);
    bell(E5, 0.14, 0.5);
    bell(G5, 0.28, 0.8);
  },
  /** 틀림: 부드러운 뿌우~ */
  wrong: () => {
    tone(330, 0, 0.22, { type: 'triangle', vol: 0.16, slideTo: 250 });
    tone(250, 0.2, 0.3, { type: 'triangle', vol: 0.14, slideTo: 180 });
  },
  /** 버튼 누름: 톡 */
  tap: () => tone(900, 0, 0.06, { vol: 0.07, slideTo: 1300 }),
  /** 힌트: 반짝반짝 */
  hint: () => [C6, E6, G6, E6, G6].forEach((f, i) => bell(f, i * 0.07, 0.3, 0.06)),
  /** 무르기: 휘리릭 되감기 */
  undo: () => {
    burst(0, 0.3, 3000, 1.5, 0.25, 600);
    tone(1200, 0, 0.25, { vol: 0.08, slideTo: 400 });
  },
  /** 한 번 쉬기 */
  pass: () => tone(400, 0, 0.3, { type: 'triangle', vol: 0.1, slideTo: 300 }),
  /** 대국 시작: 빠밤! */
  start: () => {
    tone(G5, 0, 0.12, { type: 'square', vol: 0.06 });
    tone(C6, 0.13, 0.3, { type: 'square', vol: 0.07 });
    bell(C6, 0.13, 0.5, 0.08);
  },
  /** 별 하나 (k = 0, 1, 2 점점 높게) */
  star: (k: number) => bell([E5, G5, C6][k] ?? C6, 0, 0.6, 0.18),
  /** 다음 단계로 */
  next: () => tone(600, 0, 0.1, { type: 'triangle', vol: 0.08, slideTo: 900 }),
  /** 레슨 완료 */
  lessonDone: () => {
    [C5, E5, G5, C6].forEach((f, i) => bell(f, i * 0.1, 0.5, 0.14));
    bell(E6, 0.45, 0.9, 0.12);
  },
  /** 이겼다! 빰빠밤 빰~ */
  win: () => {
    const notes: [number, number, number][] = [
      [C5, 0, 0.12], [E5, 0.12, 0.12], [G5, 0.24, 0.12], [C6, 0.36, 0.3],
      [A5, 0.7, 0.15], [G5, 0.85, 0.15], [A5, 1.0, 0.15], [C6, 1.15, 0.7],
    ];
    notes.forEach(([f, s, d]) => {
      tone(f, s, d, { type: 'square', vol: 0.05 });
      tone(f * 2, s, d, { type: 'triangle', vol: 0.08 });
    });
    [C6, E6, G6].forEach((f, i) => bell(f, 1.2 + i * 0.08, 0.6, 0.06));
  },
  /** 졌다: 와와와~ */
  lose: () => {
    [G5 / 2, (G5 / 2) * 0.94, (G5 / 2) * 0.89].forEach((f, i) => tone(f, i * 0.32, 0.3, { type: 'triangle', vol: 0.15 }));
    tone((G5 / 2) * 0.84, 0.96, 0.8, { type: 'triangle', vol: 0.15, slideTo: (G5 / 2) * 0.7 });
  },
  /** 비김 */
  draw: () => {
    bell(G5, 0, 0.4, 0.12);
    bell(G5, 0.25, 0.6, 0.12);
  },
};
