import { describe, expect, it } from 'vitest';
import type { Cell } from './go';
import { OMOK_SIZE, candidateMoves, chooseOmokMove, winningLine } from './omok';
import type { Level } from './ai';

const D = { w: OMOK_SIZE, h: OMOK_SIZE };
const idx = (x: number, y: number) => y * D.w + x;
const empty = (): Cell[] => new Array<Cell>(D.w * D.h).fill(0);
const place = (cells: Cell[], color: 1 | 2, pts: [number, number][]) => {
  for (const [x, y] of pts) cells[idx(x, y)] = color;
  return cells;
};

function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

describe('omok win check', () => {
  it.each([
    ['가로', [[2, 5], [3, 5], [4, 5], [5, 5], [6, 5]]],
    ['세로', [[7, 0], [7, 1], [7, 2], [7, 3], [7, 4]]],
    ['대각선 ↘', [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]]],
    ['대각선 ↗', [[3, 11], [4, 10], [5, 9], [6, 8], [7, 7]]],
  ] as [string, [number, number][]][])('%s 5개면 이김', (_n, pts) => {
    const cells = place(empty(), 1, pts);
    const line = winningLine(cells, D, idx(...pts[2]));
    expect(line?.length).toBe(5);
  });

  it('4개는 아직 아님, 6개도 이김', () => {
    const four = place(empty(), 1, [[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(winningLine(four, D, idx(3, 0))).toBeNull();
    const six = place(empty(), 2, [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3]]);
    expect(winningLine(six, D, idx(0, 3))?.length).toBe(6);
  });

  it('줄이 판 끝에서 다음 줄로 넘어가지 않음', () => {
    // 오른쪽 끝 3개 + 다음 줄 왼쪽 끝 2개 (배열에서는 이어져 있음)
    const cells = place(empty(), 1, [[9, 4], [10, 4], [11, 4], [0, 5], [1, 5]]);
    expect(winningLine(cells, D, idx(11, 4))).toBeNull();
  });

  it('다른 색이 끼면 끊김', () => {
    const cells = place(empty(), 1, [[0, 0], [1, 0], [3, 0], [4, 0], [5, 0]]);
    place(cells, 2, [[2, 0]]);
    expect(winningLine(cells, D, idx(1, 0))).toBeNull();
  });
});

describe('omok ai', () => {
  it('빈 판이면 가운데 근처', () => {
    const [m] = candidateMoves(empty(), D);
    const x = m % D.w;
    const y = Math.floor(m / D.w);
    expect(Math.abs(x - 5.5)).toBeLessThan(1);
    expect(Math.abs(y - 5.5)).toBeLessThan(1);
  });

  it('토끼·호랑이는 이길 수 있으면 이긴다', () => {
    const cells = place(empty(), 2, [[3, 3], [4, 3], [5, 3], [6, 3]]);
    place(cells, 1, [[3, 4], [4, 4], [5, 4], [2, 3]]);
    for (const lv of ['rabbit', 'tiger'] as Level[]) {
      expect(chooseOmokMove(cells, D, 2, lv, () => 0.5)).toBe(idx(7, 3));
    }
  });

  it('토끼·호랑이는 상대 4개를 막는다', () => {
    const cells = place(empty(), 1, [[2, 8], [3, 8], [4, 8], [5, 8]]);
    place(cells, 2, [[1, 8], [5, 5]]);
    for (const lv of ['rabbit', 'tiger'] as Level[]) {
      expect(chooseOmokMove(cells, D, 2, lv, () => 0.5)).toBe(idx(6, 8));
    }
  });

  it('호랑이는 상대의 열린 3을 막는다', () => {
    const cells = place(empty(), 1, [[4, 6], [5, 6], [6, 6]]);
    place(cells, 2, [[5, 5], [9, 9]]);
    const m = chooseOmokMove(cells, D, 2, 'tiger', () => 0.5);
    expect([idx(3, 6), idx(7, 6)]).toContain(m);
  });

  it('호랑이가 거북이를 거의 이긴다, 모든 수는 빈 칸', () => {
    let tigerWins = 0;
    for (let g = 0; g < 6; g++) {
      const rng = seeded(50 + g);
      const cells = empty();
      let turn: 1 | 2 = 1;
      for (let t = 0; t < 144; t++) {
        const m = chooseOmokMove(cells, D, turn, turn === 1 ? 'tiger' : 'turtle', rng);
        if (m === null) break;
        expect(cells[m]).toBe(0);
        cells[m] = turn;
        if (winningLine(cells, D, m)) {
          if (turn === 1) tigerWins++;
          break;
        }
        turn = turn === 1 ? 2 : 1;
      }
    }
    expect(tigerWins).toBeGreaterThanOrEqual(5);
  });
});
