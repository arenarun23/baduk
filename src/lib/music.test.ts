import { describe, expect, it } from 'vitest';
import { BAR_SEC, Composer, type NoteEvent } from './music';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

const PENTA = [0, 2, 4, 7, 9];
const KEYS = [0, 5, 7, 2, -3];
const inKey = (m: number, key: number) => PENTA.includes((((m - key) % 12) + 12) % 12);

describe('background music composer', () => {
  // 구간: A(8마디) B(8) A(8) C(4) → 조 바꾸기 → 다시
  const bars: NoteEvent[][] = [];
  const c = new Composer(seeded(3));
  for (let i = 0; i < 56; i++) bars.push(c.nextBar());
  const keyOf = (bar: number) => KEYS[Math.floor(bar / 28) % KEYS.length];

  it('한 마디는 약 3.3초 (72 bpm, 4박)', () => {
    expect(BAR_SEC).toBeCloseTo(3.333, 2);
  });

  it('모든 마디에 화음(패드)과 베이스가 있어 소리가 끊기지 않는다', () => {
    for (const b of bars) {
      expect(b.some((e) => e.inst === 'pad')).toBe(true);
      expect(b.some((e) => e.inst === 'bass')).toBe(true);
    }
  });

  it('구간 순서: 뜯는 가락 → 피리 → 뜯는 가락 → 풍경', () => {
    const lead = (b: NoteEvent[]) =>
      b.some((e) => e.inst === 'flute') ? 'B' : b.some((e) => e.inst === 'bell' || e.inst === 'drop') || !b.some((e) => e.inst === 'pluck') ? 'C' : 'A';
    const seq = bars.slice(0, 28).map(lead).join('');
    expect(seq).toBe('A'.repeat(8) + 'B'.repeat(8) + 'A'.repeat(8) + 'C'.repeat(4));
  });

  it('가락·풍경은 모두 그 조의 오음계(도레미솔라) 음', () => {
    bars.forEach((b, i) => {
      for (const e of b) {
        if (e.inst === 'pluck' && e.vel < 0.5) continue; // 아르페지오는 화음음
        if (['pluck', 'flute', 'bell', 'drop'].includes(e.inst)) expect(inKey(e.midi[0], keyOf(i))).toBe(true);
      }
    });
  });

  it('구간 끝마다 바둑돌 "딱", 가락의 8마디째 마지막 음은 으뜸음', () => {
    for (const end of [7, 15, 23, 27, 35]) expect(bars[end].some((e) => e.inst === 'stone')).toBe(true);
    for (const end of [7, 15, 23]) {
      const mel = bars[end].filter((e) => (e.inst === 'pluck' && e.vel >= 0.5) || e.inst === 'flute');
      const lastNote = mel[mel.length - 1].midi[0];
      expect((((lastNote - keyOf(end)) % 12) + 12) % 12).toBe(0);
    }
  });

  it('1-2마디 동기를 3-4마디에서 같은 리듬으로 되풀이', () => {
    const rhythm = (b: NoteEvent[]) => b.filter((e) => e.inst === 'pluck' && e.vel >= 0.5).map((e) => `${e.beat}:${e.dur}`).join(',');
    expect(rhythm(bars[2])).toBe(rhythm(bars[0]));
    expect(rhythm(bars[3])).toBe(rhythm(bars[1]));
  });

  it('조가 바뀐다 (두 번째 바퀴는 바장조)', () => {
    const melodyNotes = bars.slice(28, 36).flatMap((b) => b.filter((e) => e.inst === 'pluck' && e.vel >= 0.5).map((e) => e.midi[0]));
    expect(melodyNotes.length).toBeGreaterThan(0);
    expect(melodyNotes.every((m) => inKey(m, 5))).toBe(true);
  });
});
