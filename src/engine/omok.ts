// 오목: 가로·세로·대각선으로 내 돌 5개 이상을 먼저 나란히 놓으면 이긴다. 흑이 먼저.
// (초등 저학년용: 금수·렌주 규칙 없이 5개 이상이면 승리)
import type { Cell, Color, Dims } from './go';
import type { Level } from './ai';

export const OMOK_SIZE = 12;
const DIRS: [number, number][] = [
  [1, 0], // 가로
  [0, 1], // 세로
  [1, 1], // 대각선 ↘
  [1, -1], // 대각선 ↗
];

type Rng = () => number;

const at = (d: Dims, x: number, y: number) => (x < 0 || y < 0 || x >= d.w || y >= d.h ? -1 : y * d.w + x);

/** i 에 color 돌이 있을 때 5개 이상 이어진 줄이 있으면 그 줄의 칸들, 없으면 null */
export function winningLine(cells: Cell[], d: Dims, i: number): number[] | null {
  const color = cells[i];
  if (!color) return null;
  const x0 = i % d.w;
  const y0 = Math.floor(i / d.w);
  for (const [dx, dy] of DIRS) {
    const line = [i];
    for (const s of [1, -1]) {
      for (let k = 1; ; k++) {
        const j = at(d, x0 + dx * k * s, y0 + dy * k * s);
        if (j < 0 || cells[j] !== color) break;
        line.push(j);
      }
    }
    if (line.length >= 5) return line.sort((a, b) => a - b);
  }
  return null;
}

/** i 에 color 를 놓았을 때 그 돌을 지나는 "5칸 창" 점수. 창 안에 상대 돌이 없을 때 내 돌 수가 많을수록 큼 */
const WINDOW_VALUE = [0, 1, 12, 150, 2500, 1_000_000];

export function linePotential(cells: Cell[], d: Dims, i: number, color: Color): number {
  const x0 = i % d.w;
  const y0 = Math.floor(i / d.w);
  let total = 0;
  for (const [dx, dy] of DIRS) {
    // i 를 포함하는 5칸 창: 시작점을 -4..0 만큼 옮겨 가며
    for (let start = -4; start <= 0; start++) {
      let mine = 0;
      let blocked = false;
      for (let k = 0; k < 5; k++) {
        const off = start + k;
        const j = at(d, x0 + dx * off, y0 + dy * off);
        if (j < 0) { blocked = true; break; }
        const c = off === 0 ? color : cells[j];
        if (c === color) mine++;
        else if (c !== 0) { blocked = true; break; }
      }
      if (!blocked) total += WINDOW_VALUE[mine];
    }
  }
  return total;
}

/** 이미 놓인 돌 근처(2칸 안)의 빈 칸. 판이 비었으면 가운데 */
export function candidateMoves(cells: Cell[], d: Dims): number[] {
  const out: number[] = [];
  let any = false;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]) { any = true; continue; }
    const x = i % d.w;
    const y = Math.floor(i / d.w);
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const j = at(d, x + dx, y + dy);
        if (j >= 0 && cells[j]) { near = true; break; }
      }
    }
    if (near) out.push(i);
  }
  if (!any) {
    const c = Math.floor(d.h / 2) * d.w + Math.floor(d.w / 2) - (d.w % 2 ? 0 : 1);
    return [c];
  }
  return out;
}

const other = (c: Color): Color => (c === 1 ? 2 : 1);

/** 놓으면 바로 이기는 자리들 */
export function winningMoves(cells: Cell[], d: Dims, color: Color): number[] {
  const out: number[] = [];
  for (const m of candidateMoves(cells, d)) {
    const next = cells.slice();
    next[m] = color;
    if (winningLine(next, d, m)) out.push(m);
  }
  return out;
}

const pick = <T,>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

/**
 * AI 의 다음 수 (둘 곳이 없으면 null)
 * 🐢 거북이: 자주 아무 데나, 이길 수 있을 때도 가끔 놓침
 * 🐰 토끼: 이기는 수·막는 수는 보고, 나머지는 점수 위쪽에서 골고루
 * 🐯 호랑이: 공격·수비 점수를 꼼꼼히 계산해 가장 좋은 곳
 */
export function chooseOmokMove(cells: Cell[], d: Dims, color: Color, level: Level, rng: Rng = Math.random): number | null {
  const cands = candidateMoves(cells, d);
  if (!cands.length) return null;
  const opp = other(color);
  const win = winningMoves(cells, d, color);
  const block = winningMoves(cells, d, opp);

  if (level === 'turtle') {
    if (win.length && rng() < 0.6) return pick(win, rng);
    if (block.length && rng() < 0.4) return pick(block, rng);
    if (rng() < 0.55) return pick(cands, rng);
  } else {
    if (win.length) return pick(win, rng);
    if (block.length && (level === 'tiger' || rng() < 0.9)) return pick(block, rng);
  }

  const defense = level === 'tiger' ? 0.95 : level === 'rabbit' ? 0.7 : 0.4;
  const scored = cands
    .map((m) => ({
      m,
      s: linePotential(cells, d, m, color) + defense * linePotential(cells, d, m, opp) + rng() * (level === 'tiger' ? 1 : 30),
    }))
    .sort((a, b) => b.s - a.s);
  if (level === 'tiger') return scored[0].m;
  // 토끼·거북이: 위쪽 몇 개 중에서 고르기 (실수할 여지)
  const top = scored.slice(0, level === 'rabbit' ? 3 : 6);
  return pick(top, rng).m;
}

export const OMOK_AI_DESC: Record<Level, string> = {
  turtle: '느릿느릿, 오목 처음 하는 친구에게 딱!',
  rabbit: '4개가 되면 막아요. 조심조심!',
  tiger: '공격도 수비도 잘해요. 진짜 도전!',
};
