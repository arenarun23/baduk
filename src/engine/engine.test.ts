import { describe, expect, it } from 'vitest';
import { BLACK, WHITE, emptyPosition, getGroup, legalMoves, parseRows, play, toIndex } from './go';
import { canCapture, chooseMove, type Level } from './ai';
import { lessons } from '../data/lessons';
import { quiz } from '../data/quiz';
import { countAnswer, defaultChoices, oxAnswer, solutions, type Step } from '../data/steps';

const at = (size: number, x: number, y: number) => toIndex(size, x, y);

function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

describe('rules', () => {
  it('counts liberties in center, edge and corner', () => {
    const { pos } = parseRows(['X.X..', '.....', '..X..', '.....', '.....']);
    expect(getGroup(pos.cells, 5, at(5, 2, 2)).liberties).toHaveLength(4);
    expect(getGroup(pos.cells, 5, at(5, 2, 0)).liberties).toHaveLength(3);
    expect(getGroup(pos.cells, 5, at(5, 0, 0)).liberties).toHaveLength(2);
  });

  it('captures a surrounded stone and counts it', () => {
    const { pos } = parseRows(['.....', '..X..', '.XO..', '..X..', '.....']);
    const r = play(pos, at(5, 3, 2), BLACK);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.captured).toEqual([at(5, 2, 2)]);
    expect(r.pos.cells[at(5, 2, 2)]).toBe(0);
    expect(r.pos.captures[BLACK]).toBe(1);
  });

  it('forbids suicide and occupied points', () => {
    const { pos } = parseRows(['.O...', 'O....', '.....', '.....', '.....']);
    expect(play(pos, 0, BLACK)).toEqual({ ok: false, reason: 'suicide' });
    expect(play(pos, 1, BLACK)).toEqual({ ok: false, reason: 'occupied' });
  });

  it('allows a no-liberty move that captures', () => {
    const { pos } = parseRows(['.OX..', 'OX...', 'X....', '.....', '.....']);
    const r = play(pos, 0, BLACK);
    expect(r.ok && r.captured.length).toBe(2);
  });

  it('enforces ko', () => {
    const { pos } = parseRows(['.XO..', 'XO.O.', '.XO..', '.....', '.....']);
    const r = play(pos, at(5, 2, 1), BLACK);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(play(r.pos, at(5, 1, 1), WHITE)).toEqual({ ok: false, reason: 'ko' });
    // 다른 곳에 한 번씩 두고 오면 다시 따낼 수 있다
    const w = play(r.pos, at(5, 4, 4), WHITE);
    if (!w.ok) throw new Error();
    const b = play(w.pos, at(5, 0, 4), BLACK);
    if (!b.ok) throw new Error();
    expect(play(b.pos, at(5, 1, 1), WHITE).ok).toBe(true);
  });
});

describe('ladder reading', () => {
  it('sees a working ladder', () => {
    // 흑이 (3,2)로 단수치면 백은 축으로 잡힌다
    const { pos } = parseRows([
      '.......',
      '.......',
      '..XO...',
      '..X....',
      '.......',
      '.......',
      '.......',
    ]);
    // 백 (3,2) 숨구멍: (3,1),(4,2),(3,3) - 3개라 바로는 못 잡음
    expect(canCapture(pos, at(7, 3, 2), BLACK)).toBe(false);
    const { pos: p2 } = parseRows(['.......', '...X...', '..XO...', '..X....', '.......', '.......', '.......']);
    // 숨구멍 2개 (4,2),(3,3): (4,2)로 단수치면 축으로 잡힘
    expect(canCapture(p2, at(7, 3, 2), BLACK)).toBe(true);
    // 축머리에 백돌이 있으면 탈출
    const { pos: p3 } = parseRows(['.......', '...X...', '..XO...', '..X....', '.......', '....O..', '.......']);
    expect(canCapture(p3, at(7, 3, 2), BLACK)).toBe(false);
  });
});

describe('ai', () => {
  const levels: Level[] = ['turtle', 'rabbit', 'tiger'];

  it('always returns a legal move or passes', () => {
    for (const level of levels) {
      const rng = seeded(7);
      let pos = emptyPosition(7);
      for (let t = 0; t < 40; t++) {
        const m = chooseMove(pos, pos.toPlay, level, rng);
        if (m === null) {
          expect(legalMoves(pos)).toHaveLength(0);
          break;
        }
        const r = play(pos, m);
        expect(r.ok).toBe(true);
        if (r.ok) pos = r.pos;
      }
    }
  });

  it('rabbit and tiger take a free capture', () => {
    const { pos } = parseRows(['.....', '..O..', '.OX..', '..O..', '.....'], WHITE);
    for (const level of ['rabbit', 'tiger'] as Level[]) {
      // 토끼는 15% 확률로 실수하므로 실수하지 않는 난수 사용
      expect(chooseMove(pos, WHITE, level, () => 0.5)).toBe(at(5, 3, 2));
    }
  });

  it('tiger escapes from atari', () => {
    const { pos } = parseRows(['.....', '..X..', '.XO..', '..X..', '.....'], WHITE);
    expect(chooseMove(pos, WHITE, 'tiger', () => 0.5)).toBe(at(5, 3, 2));
  });

  it('tiger beats turtle most of the time', () => {
    let tigerWins = 0;
    for (let g = 0; g < 6; g++) {
      const rng = seeded(100 + g);
      let pos = emptyPosition(5);
      for (let t = 0; t < 60; t++) {
        const level: Level = pos.toPlay === BLACK ? 'tiger' : 'turtle';
        const m = chooseMove(pos, pos.toPlay, level, rng);
        if (m === null) break;
        const r = play(pos, m);
        if (!r.ok) break;
        pos = r.pos;
        if (pos.captures[BLACK] >= 3 || pos.captures[WHITE] >= 3) break;
      }
      if (pos.captures[BLACK] > pos.captures[WHITE]) tigerWins++;
    }
    expect(tigerWins).toBeGreaterThanOrEqual(5);
  });
});

describe('lesson and quiz content', () => {
  const all: [string, Step][] = [
    ...lessons.flatMap((l) => l.steps.map((s, i) => [`${l.id}#${i}`, s] as [string, Step])),
    ...quiz.map((s, i) => [`quiz#${i}`, s] as [string, Step]),
  ];

  it.each(all)('%s is well-formed', (_name, step) => {
    if (step.rows) parseRows(step.rows);
    if (step.kind === 'move') expect(solutions(step.rows, step.goal).length).toBeGreaterThan(0);
    if (step.kind === 'count') expect(step.choices ?? defaultChoices).toContain(countAnswer(step.rows));
    if (step.kind === 'ox') oxAnswer(step.rows);
  });

  it('has both O and X answers in the quiz', () => {
    const ox = quiz.filter((s) => s.kind === 'ox').map((s) => oxAnswer(s.rows));
    expect(ox).toContain(true);
    expect(ox).toContain(false);
  });
});
