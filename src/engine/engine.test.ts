import { describe, expect, it } from 'vitest';
import { BLACK, WHITE, emptyPosition, getGroup, legalMoves, neighbors, parseRows, play, toIndex } from './go';
import { canCapture, chooseMove, type Level } from './ai';
import { lessons } from '../data/lessons';
import { quiz } from '../data/quiz';
import { countAnswer, defaultChoices, oxAnswer, solutions, type Step } from '../data/steps';

const at = (size: number, x: number, y: number) => toIndex({ w: size, h: size }, x, y);

function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

describe('rules', () => {
  it('counts liberties in center, edge and corner', () => {
    const { pos } = parseRows(['X.X..', '.....', '..X..', '.....', '.....']);
    expect(getGroup(pos.cells, pos, at(5, 2, 2)).liberties).toHaveLength(4);
    expect(getGroup(pos.cells, pos, at(5, 2, 0)).liberties).toHaveLength(3);
    expect(getGroup(pos.cells, pos, at(5, 0, 0)).liberties).toHaveLength(2);
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

describe('rectangular boards (14×15)', () => {
  it('uses width for rows and height for columns', () => {
    const pos = emptyPosition(14, 15);
    expect(pos.cells).toHaveLength(14 * 15);
    const d = { w: 14, h: 15 };
    // 오른쪽 아래 귀 (13,14): 이웃은 위쪽과 왼쪽 2개뿐
    expect(neighbors(d, toIndex(d, 13, 14)).sort((a, b) => a - b)).toEqual([toIndex(d, 13, 13), toIndex(d, 12, 14)]);
    // 오른쪽 끝 (13,0) 의 오른쪽은 다음 줄로 넘어가지 않는다
    expect(neighbors(d, toIndex(d, 13, 0))).not.toContain(toIndex(d, 0, 1));
  });

  it('captures in the bottom-right corner', () => {
    let pos = emptyPosition(14, 15);
    const d = { w: 14, h: 15 };
    for (const [m, c] of [[toIndex(d, 13, 14), WHITE], [toIndex(d, 12, 14), BLACK]] as const) {
      const r = play(pos, m, c);
      if (!r.ok) throw new Error();
      pos = r.pos;
    }
    const r = play(pos, toIndex(d, 13, 13), BLACK);
    expect(r.ok && r.captured).toEqual([toIndex(d, 13, 14)]);
  });

  it('parses non-square rows', () => {
    const { pos } = parseRows(['X..', '...', '..O', '...']);
    expect([pos.w, pos.h]).toEqual([3, 4]);
    expect(pos.cells[toIndex(pos, 2, 2)]).toBe(WHITE);
  });

  it('every AI plays legal moves on 12×12, 14×15, 17×17, 19×19 and 24×24', () => {
    for (const [w, h] of [[12, 12], [14, 15], [17, 17], [19, 19], [24, 24]]) {
      for (const level of ['turtle', 'rabbit', 'tiger'] as Level[]) {
        const rng = seeded(w * 31 + h);
        let pos = emptyPosition(w, h);
        for (let t = 0; t < 30; t++) {
          const m = chooseMove(pos, pos.toPlay, level, rng);
          if (m === null) break;
          const r = play(pos, m);
          expect(r.ok).toBe(true);
          if (r.ok) pos = r.pos;
        }
      }
    }
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
