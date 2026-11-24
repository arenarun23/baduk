// 배경 음악: 소리 파일 없이 Web Audio 로 그때그때 만드는 잔잔한 오음계(도레미솔라) 음악.
//  - 가야금 같은 뜯는 소리, 부드러운 피리, 은은한 화음(패드), 낮은 베이스, 풍경·물방울, 바둑돌 "딱"
//  - 지루하지 않게: 짧은 가락(동기)을 되풀이·변형하고, 구간(A 뜯는 가락 / B 피리 + 아르페지오 / C 풍경)이 돌아가며 조도 바뀐다
//  - 같은 코드로 실시간 재생(MusicPlayer)과 미리 듣기 파일 만들기(scheduleMusic + OfflineAudioContext)를 한다

type Rng = () => number;

export type Instrument = 'pluck' | 'flute' | 'pad' | 'bass' | 'bell' | 'drop' | 'stone';
export interface NoteEvent {
  inst: Instrument;
  /** 마디 시작부터 박 단위 */
  beat: number;
  /** 박 단위 길이 */
  dur: number;
  /** MIDI 음높이 (pad 는 여러 음) */
  midi: number[];
  vel: number;
}

export const BPM = 72;
const BEAT = 60 / BPM;
export const BAR_SEC = BEAT * 4;

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PENTA = [0, 2, 4, 7, 9]; // 도 레 미 솔 라
const KEYS = [0, 5, 7, 2, -3]; // 다 → 바 → 사 → 라 → 가 (조 바꾸기)
const PROGRESSIONS = [
  [0, 5, 3, 4, 0, 5, 3, 4], // I vi IV V
  [3, 4, 0, 5, 3, 4, 0, 0],
  [5, 3, 0, 4, 5, 3, 4, 0],
  [0, 3, 5, 4, 0, 3, 4, 0],
];
// 한 마디 리듬 (박), 음수 = 쉼표
const RHYTHMS = [
  [2, 2], [1, 1, 2], [1, 1, 1, 1], [1.5, 0.5, 2], [0.5, 0.5, 1, 2], [1, 2, 1], [3, 1], [1, 1, -2], [2, -1, 1], [-1, 1, 2],
];
const SLOW_RHYTHMS = [[4], [2, 2], [3, 1], [2, -2], [-1, 3]];

type Section = 'A' | 'B' | 'C';
const ORDER: Section[] = ['A', 'B', 'A', 'C'];

const pick = <T,>(a: T[], rng: Rng): T => a[Math.floor(rng() * a.length)];

function chordTones(key: number, degree: number): number[] {
  // 근음·3음·5음 (0~11 반음)
  return [0, 2, 4].map((k) => (key + MAJOR[(degree + k) % 7] + 12) % 12);
}

function pentaNotes(key: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (PENTA.includes((((m - key) % 12) + 12) % 12)) out.push(m);
  return out;
}

/** 마디를 하나씩 만들어 주는 작곡가 */
export class Composer {
  private bar = 0;
  private sectionIdx = 0;
  private keyIdx = 0;
  private prog = PROGRESSIONS[0];
  private motif: { rhythm: number[]; steps: number[] }[] = [];
  private lastNote = 72;
  constructor(private rng: Rng) {
    this.prog = pick(PROGRESSIONS, rng);
  }

  private get section(): Section {
    return ORDER[this.sectionIdx % ORDER.length];
  }
  private get sectionBars(): number {
    return this.section === 'C' ? 4 : 8;
  }

  /** 다음 한 마디의 음표들 */
  nextBar(): NoteEvent[] {
    const rng = this.rng;
    const key = KEYS[this.keyIdx % KEYS.length];
    const pos = this.bar; // 구간 안 몇 번째 마디
    const degree = this.prog[pos % 8];
    const tones = chordTones(key, degree);
    const root = 48 + tones[0]; // C3~B3 사이 근음
    const ev: NoteEvent[] = [];

    // 화음 (패드): 근음·5음·3음을 가운데 음역에
    const padNotes = [root + 12, ...tones.slice(1).map((t) => 60 + t)];
    ev.push({ inst: 'pad', beat: 0, dur: 4.2, midi: padNotes, vel: this.section === 'C' ? 0.8 : 0.6 });
    // 베이스: 1박, 가끔 3박에 5음
    ev.push({ inst: 'bass', beat: 0, dur: 2, midi: [root - 12], vel: 0.8 });
    if (rng() < 0.4) ev.push({ inst: 'bass', beat: 2, dur: 2, midi: [root - 5], vel: 0.5 });

    const sec = this.section;
    if (sec === 'A' || sec === 'B') {
      ev.push(...this.melodyBar(key, tones, pos, sec === 'A' ? 'pluck' : 'flute'));
      if (sec === 'B') {
        // 뜯는 소리 아르페지오 (작게)
        const arp = [root + 12, padNotes[1], padNotes[2], padNotes[1] + 12];
        arp.forEach((m, k) => ev.push({ inst: 'pluck', beat: k, dur: 1, midi: [m], vel: 0.28 }));
      }
    } else {
      // C: 풍경·물방울이 드문드문
      const high = pentaNotes(key, 79, 96);
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) ev.push({ inst: 'bell', beat: Math.floor(rng() * 8) / 2, dur: 2, midi: [pick(high, rng)], vel: 0.6 + rng() * 0.3 });
      if (rng() < 0.5) ev.push({ inst: 'drop', beat: 1 + Math.floor(rng() * 6) / 2, dur: 0.5, midi: [pick(pentaNotes(key, 72, 84), rng)], vel: 0.7 });
    }

    // 구간 끝: 바둑돌 "딱"
    const last = pos === this.sectionBars - 1;
    if (last) ev.push({ inst: 'stone', beat: 3.5, dur: 0.2, midi: [0], vel: 0.8 });

    // 다음 마디로
    this.bar++;
    if (this.bar >= this.sectionBars) {
      this.bar = 0;
      this.motif = [];
      if (this.section === 'C') this.keyIdx++; // C 구간 뒤에 조 바꾸기
      this.sectionIdx++;
      this.prog = pick(PROGRESSIONS, rng);
    }
    return ev;
  }

  /** 8마디 가락: 1-2 동기, 3-4 동기 되풀이(화음에 맞춰 옮김), 5-6 새 가락, 7 이어서, 8 으뜸음으로 마침 */
  private melodyBar(key: number, tones: number[], pos: number, inst: 'pluck' | 'flute'): NoteEvent[] {
    const rng = this.rng;
    const lo = inst === 'flute' ? 67 : 62;
    const hi = inst === 'flute' ? 86 : 81;
    const scale = pentaNotes(key, lo, hi);
    const nearestIdx = (m: number) => scale.reduce((bi, v, i) => (Math.abs(v - m) < Math.abs(scale[bi] - m) ? i : bi), 0);
    const chordIdx = (m: number) => {
      // m 근처의 화음음(오음계 안) 위치
      const cands = scale.map((v, i) => [v, i] as const).filter(([v]) => tones.includes(v % 12));
      if (!cands.length) return nearestIdx(m);
      return cands.reduce((b, c) => (Math.abs(c[0] - m) < Math.abs(b[0] - m) ? c : b))[1];
    };

    let rhythm: number[];
    let steps: number[] | null = null;
    const slot = pos % 8;
    if ((slot === 2 || slot === 3) && this.motif[slot - 2]) {
      ({ rhythm, steps } = this.motif[slot - 2]);
    } else if (slot === 7) {
      rhythm = pick([[2, 2], [4], [1, 3], [2, -2]], rng);
    } else {
      rhythm = pick(inst === 'flute' ? SLOW_RHYTHMS.concat(RHYTHMS.slice(0, 3)) : RHYTHMS, rng);
    }

    const ev: NoteEvent[] = [];
    let beat = 0;
    let idx = chordIdx(this.lastNote);
    const newSteps: number[] = [];
    rhythm.forEach((d, n) => {
      const len = Math.abs(d);
      if (d > 0) {
        let step: number;
        if (steps) step = steps[n] ?? 0;
        else step = pick([-2, -1, -1, 0, 1, 1, 2, -3, 3], rng);
        if (n === 0 && !steps) {
          idx = chordIdx(scale[Math.max(0, Math.min(scale.length - 1, idx + step))]); // 센박은 화음음
        } else {
          idx = Math.max(0, Math.min(scale.length - 1, idx + step));
        }
        if (slot === 7 && n === rhythm.filter((x) => x > 0).length - 1) {
          // 마지막 음은 으뜸음(조의 도)
          const tonics = scale.map((v, i) => [v, i] as const).filter(([v]) => (((v - key) % 12) + 12) % 12 === 0);
          idx = tonics.reduce((b, c) => (Math.abs(c[1] - idx) < Math.abs(b[1] - idx) ? c : b))[1];
        }
        newSteps.push(step);
        ev.push({ inst, beat, dur: len, midi: [scale[idx]], vel: inst === 'flute' ? 0.7 : 0.75 + rng() * 0.2 });
      } else newSteps.push(0);
      beat += len;
    });
    if (slot < 2) this.motif[slot] = { rhythm, steps: newSteps };
    this.lastNote = scale[idx];
    return ev;
  }
}

// ---------------- 악기 ----------------

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export interface Bus {
  ctx: BaseAudioContext;
  dry: AudioNode;
  wet: AudioNode;
  noise: AudioBuffer;
}

function env(g: GainNode, t: number, peak: number, attack: number, hold: number, release: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  if (hold > 0) g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return t + attack + hold + release + 0.05;
}

function connect(bus: Bus, node: AudioNode, wet: number) {
  node.connect(bus.dry);
  if (wet > 0) {
    const s = bus.ctx.createGain();
    s.gain.value = wet;
    node.connect(s).connect(bus.wet);
  }
}

function osc(bus: Bus, type: OscillatorType, f: number, t: number, end: number, out: AudioNode) {
  const o = bus.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.connect(out);
  o.start(t);
  o.stop(end);
  return o;
}

export function playEvent(bus: Bus, e: NoteEvent, t: number) {
  const c = bus.ctx;
  const dur = e.dur * BEAT;
  switch (e.inst) {
    case 'pluck': {
      // 가야금처럼 뜯는 소리: 시작이 살짝 높았다 내려오고, 금방 작아짐
      const f = hz(e.midi[0]);
      const g = c.createGain();
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(700, t + 0.6);
      const end = env(g, t, 0.16 * e.vel, 0.006, 0, 1.8);
      const o1 = osc(bus, 'triangle', f * 1.012, t, end, lp);
      o1.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      osc(bus, 'sine', f * 2.004, t, end, lp);
      lp.connect(g);
      connect(bus, g, 0.45);
      break;
    }
    case 'flute': {
      // 부드러운 피리: 천천히 커지고 살짝 떨림
      const f = hz(e.midi[0]);
      const g = c.createGain();
      const end = env(g, t, 0.075 * e.vel, 0.12, Math.max(0, dur - 0.35), 0.35);
      const o = osc(bus, 'sine', f, t, end, g);
      const g2 = c.createGain();
      g2.gain.value = 0.12;
      g2.connect(g);
      osc(bus, 'sine', f * 2, t, end, g2); // 배음
      const lfo = c.createOscillator();
      const lfoG = c.createGain();
      lfo.frequency.value = 5;
      lfoG.gain.setValueAtTime(0, t);
      lfoG.gain.linearRampToValueAtTime(f * 0.006, t + 0.4);
      lfo.connect(lfoG).connect(o.frequency);
      lfo.start(t);
      lfo.stop(end);
      // 숨소리
      const n = c.createBufferSource();
      n.buffer = bus.noise;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * 2;
      bp.Q.value = 2;
      const ng = c.createGain();
      env(ng, t, 0.012 * e.vel, 0.08, 0, 0.3);
      n.connect(bp).connect(ng).connect(g);
      n.start(t);
      n.stop(t + 0.45);
      connect(bus, g, 0.5);
      break;
    }
    case 'pad': {
      // 은은한 화음: 아주 천천히 커졌다 작아짐
      const g = c.createGain();
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const end = env(g, t, 0.022 * e.vel, 1.2, Math.max(0, dur - 1.6), 1.6);
      for (const m of e.midi) {
        osc(bus, 'triangle', hz(m) * 0.998, t, end, lp);
        osc(bus, 'triangle', hz(m) * 1.002, t, end, lp);
      }
      lp.connect(g);
      connect(bus, g, 0.6);
      break;
    }
    case 'bass': {
      const f = hz(e.midi[0]);
      const g = c.createGain();
      const end = env(g, t, 0.13 * e.vel, 0.02, 0, Math.min(2.2, dur + 0.6));
      osc(bus, 'sine', f, t, end, g);
      connect(bus, g, 0.15);
      break;
    }
    case 'bell': {
      // 풍경: 맑은 종소리 (배음 섞기)
      const f = hz(e.midi[0]);
      const g = c.createGain();
      const end = env(g, t, 0.035 * e.vel, 0.004, 0, 2.6);
      osc(bus, 'sine', f, t, end, g);
      const g2 = c.createGain();
      g2.gain.value = 0.25;
      g2.connect(g);
      osc(bus, 'sine', f * 2.76, t, t + 0.9, g2);
      connect(bus, g, 0.8);
      break;
    }
    case 'drop': {
      // 물방울: 짧게 "똑" 올라가는 소리
      const f = hz(e.midi[0]);
      const g = c.createGain();
      const end = env(g, t, 0.05 * e.vel, 0.003, 0, 0.25);
      osc(bus, 'sine', f, t, end, g).frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.09);
      connect(bus, g, 0.7);
      break;
    }
    case 'stone': {
      // 바둑돌 놓는 "딱" (아주 작게)
      const n = c.createBufferSource();
      n.buffer = bus.noise;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2400;
      bp.Q.value = 3;
      const g = c.createGain();
      env(g, t, 0.25 * e.vel, 0.001, 0, 0.06);
      n.connect(bp).connect(g);
      n.start(t);
      n.stop(t + 0.1);
      const th = c.createGain();
      const end = env(th, t, 0.08 * e.vel, 0.002, 0, 0.1);
      osc(bus, 'sine', 180, t, end, th).frequency.exponentialRampToValueAtTime(110, t + 0.1);
      connect(bus, g, 0.4);
      connect(bus, th, 0.2);
      break;
    }
  }
}

/** 은은한 울림(리버브)과 섞기 회로. out 으로 나감 */
export function makeBus(ctx: BaseAudioContext, out: AudioNode): Bus {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 2.8);
  const ir = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.32;
  conv.connect(wetGain).connect(out);
  const dry = ctx.createGain();
  dry.gain.value = 1;
  dry.connect(out);
  const noise = ctx.createBuffer(1, sr, sr);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return { ctx, dry, wet: conv, noise };
}

/** 미리 정해진 길이만큼 모두 예약 (미리 듣기 파일 만들기용) */
export function scheduleMusic(bus: Bus, composer: Composer, startTime: number, seconds: number) {
  for (let t = startTime; t < startTime + seconds; t += BAR_SEC) {
    for (const e of composer.nextBar()) playEvent(bus, e, t + e.beat * BEAT);
  }
}

/** 실시간 재생기: 0.1초마다 앞으로 0.8초 안에 시작할 마디를 예약 */
export class MusicPlayer {
  private bus: Bus | null = null;
  private gain: GainNode | null = null;
  private timer: number | null = null;
  private nextBarAt = 0;
  private composer = new Composer(Math.random);
  private level = 1;

  constructor(private getCtx: () => { a: AudioContext; out: AudioNode } | null, private volume = 0.55) {}

  get playing() {
    return this.timer !== null;
  }

  start() {
    if (this.timer !== null) return;
    const g = this.getCtx();
    if (!g) return;
    if (!this.bus) {
      this.gain = g.a.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(g.out);
      this.bus = makeBus(g.a, this.gain);
    }
    const now = g.a.currentTime;
    this.gain!.gain.cancelScheduledValues(now);
    this.gain!.gain.setValueAtTime(this.gain!.gain.value, now);
    this.gain!.gain.linearRampToValueAtTime(this.volume * this.level, now + 2.5); // 살며시 시작
    this.nextBarAt = Math.max(this.nextBarAt, now + 0.15);
    this.timer = window.setInterval(() => this.tick(), 100);
    this.tick();
  }

  stop() {
    if (this.timer === null) return;
    window.clearInterval(this.timer);
    this.timer = null;
    const a = this.bus!.ctx;
    this.gain!.gain.cancelScheduledValues(a.currentTime);
    this.gain!.gain.setValueAtTime(this.gain!.gain.value, a.currentTime);
    this.gain!.gain.linearRampToValueAtTime(0, a.currentTime + 0.8);
    this.nextBarAt = a.currentTime + 1.2; // 이미 예약된 음이 끝난 뒤부터 다시
  }

  /** 읽어 주기 같은 목소리가 나올 때 살짝 줄이기 */
  duck(on: boolean) {
    this.level = on ? 0.3 : 1;
    if (!this.gain || this.timer === null) return;
    const a = this.bus!.ctx;
    this.gain.gain.cancelScheduledValues(a.currentTime);
    this.gain.gain.setValueAtTime(this.gain.gain.value, a.currentTime);
    this.gain.gain.linearRampToValueAtTime(this.volume * this.level, a.currentTime + (on ? 0.3 : 1.2));
  }

  private tick() {
    const a = this.bus!.ctx;
    // 화면이 멈췄다 돌아와서 많이 밀렸으면 지금부터
    if (this.nextBarAt < a.currentTime) this.nextBarAt = a.currentTime + 0.1;
    while (this.nextBarAt < a.currentTime + 0.8) {
      for (const e of this.composer.nextBar()) playEvent(this.bus!, e, this.nextBarAt + e.beat * BEAT);
      this.nextBarAt += BAR_SEC;
    }
  }
}
