// 인공지능 상대: 🐢 거북이(쉬움) · 🐰 토끼(보통) · 🐯 호랑이(어려움)
import {
  allGroups,
  getGroup,
  legalMoves,
  neighbors,
  other,
  play,
  type Color,
  type Position,
} from './go';

export type Level = 'turtle' | 'rabbit' | 'tiger';
type Rng = () => number;

const pick = <T,>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

// ---------- 수읽기 (축 포함) ----------

interface Budget {
  left: number;
}

/**
 * attacker 차례일 때, stone 이 속한 무리를 잡을 수 있을까?
 * 숨구멍이 3개 이상이면 잡을 수 없다고 본다 (초급용 수읽기).
 */
export function canCapture(
  pos: Position,
  stone: number,
  attacker: Color,
  depth = 20,
  budget: Budget = { left: 600 },
): boolean {
  const defender = other(attacker);
  if (pos.cells[stone] !== defender) return true;
  const g = getGroup(pos.cells, pos.size, stone);
  if (g.liberties.length === 1) return play(pos, g.liberties[0], attacker).ok;
  if (g.liberties.length > 2 || depth <= 0 || --budget.left <= 0) return false;
  for (const lib of g.liberties) {
    const r = play(pos, lib, attacker);
    if (!r.ok) continue;
    if (!canEscape(r.pos, stone, attacker, depth - 1, budget)) return true;
  }
  return false;
}

/** defender 차례일 때, 잡히지 않게 살아날 수가 있을까? */
export function canEscape(
  pos: Position,
  stone: number,
  attacker: Color,
  depth = 20,
  budget: Budget = { left: 600 },
): boolean {
  const defender = other(attacker);
  if (pos.cells[stone] !== defender) return false;
  const g = getGroup(pos.cells, pos.size, stone);
  if (g.liberties.length >= 3) return true;
  const candidates = new Set<number>(g.liberties);
  // 둘러싼 상대 돌이 단수면 따내서 탈출
  for (const s of g.stones) {
    for (const n of neighbors(pos.size, s)) {
      if (pos.cells[n] !== attacker) continue;
      const ag = getGroup(pos.cells, pos.size, n);
      if (ag.liberties.length === 1) candidates.add(ag.liberties[0]);
    }
  }
  for (const c of candidates) {
    if (--budget.left <= 0) return true;
    const r = play(pos, c, defender);
    if (!r.ok || r.pos.cells[stone] !== defender) continue;
    if (!canCapture(r.pos, stone, attacker, depth - 1, budget)) return true;
  }
  // 아무것도 안 해도 안전한 경우 (숨구멍 2개 + 상대가 못 잡음)
  if (g.liberties.length === 2 && !canCapture(pos, stone, attacker, depth - 1, budget)) return true;
  return false;
}

// ---------- 공통 도우미 ----------

function captureMoves(pos: Position, color: Color): { move: number; count: number }[] {
  const out: { move: number; count: number }[] = [];
  for (const m of legalMoves(pos, color)) {
    const r = play(pos, m, color);
    if (r.ok && r.captured.length > 0) out.push({ move: m, count: r.captured.length });
  }
  return out;
}

function libertiesAfter(pos: Position, m: number, color: Color): number {
  const r = play(pos, m, color);
  if (!r.ok) return -1;
  return getGroup(r.pos.cells, r.pos.size, m).liberties.length;
}

function isSelfAtari(pos: Position, m: number, color: Color): boolean {
  const r = play(pos, m, color);
  if (!r.ok) return true;
  return r.captured.length === 0 && getGroup(r.pos.cells, r.pos.size, m).liberties.length === 1;
}

function edgeDistance(size: number, i: number): number {
  const x = i % size;
  const y = Math.floor(i / size);
  return Math.min(x, y, size - 1 - x, size - 1 - y);
}

// ---------- 🐢 거북이 ----------

function turtleMove(pos: Position, color: Color, rng: Rng): number | null {
  const moves = legalMoves(pos, color);
  if (!moves.length) return null;
  const caps = captureMoves(pos, color);
  if (caps.length && rng() < 0.35) return pick(caps, rng).move;
  return pick(moves, rng);
}

// ---------- 🐰 토끼 ----------

function rabbitMove(pos: Position, color: Color, rng: Rng): number | null {
  const moves = legalMoves(pos, color);
  if (!moves.length) return null;
  if (rng() < 0.15) return pick(moves, rng); // 가끔 실수

  // 1. 잡을 수 있으면 잡기 (가장 많이)
  const caps = captureMoves(pos, color);
  if (caps.length) {
    const best = Math.max(...caps.map((c) => c.count));
    return pick(caps.filter((c) => c.count === best), rng).move;
  }

  // 2. 내 돌이 단수면 도망가기
  for (const g of allGroups(pos, color)) {
    if (g.liberties.length !== 1) continue;
    const m = g.liberties[0];
    if (libertiesAfter(pos, m, color) >= 2) return m;
  }

  // 3. 상대를 단수로 만들기
  const opp = other(color);
  const ataris = moves.filter((m) => {
    const r = play(pos, m, color);
    if (!r.ok || getGroup(r.pos.cells, r.pos.size, m).liberties.length < 2) return false;
    return neighbors(pos.size, m).some(
      (n) => r.pos.cells[n] === opp && getGroup(r.pos.cells, r.pos.size, n).liberties.length === 1,
    );
  });
  if (ataris.length) return pick(ataris, rng);

  // 4. 돌 근처에, 스스로 단수 안 되게
  const safe = moves.filter((m) => !isSelfAtari(pos, m, color));
  const near = safe.filter((m) =>
    neighbors(pos.size, m).some((n) => pos.cells[n] !== 0) ||
    neighbors(pos.size, m).some((n) => neighbors(pos.size, n).some((k) => pos.cells[k] !== 0)),
  );
  if (near.length) return pick(near, rng);
  if (safe.length) {
    const center = safe.filter((m) => edgeDistance(pos.size, m) >= 1);
    return pick(center.length ? center : safe, rng);
  }
  return pick(moves, rng);
}

// ---------- 🐯 호랑이 ----------

export function scoreMove(pos: Position, m: number, color: Color, rng: Rng = Math.random): number {
  const r = play(pos, m, color);
  if (!r.ok) return -Infinity;
  const opp = other(color);
  const after = r.pos;
  let score = r.captured.length * 1000;

  // 내 돌 무리가 잡힐 위험 (상대 차례)
  for (const g of allGroups(after, color)) {
    if (g.liberties.length > 2) continue;
    if (canCapture(after, g.stones[0], opp)) score -= 700 * g.stones.length + 200;
  }

  // 상대 돌 무리를 몰아붙이기
  for (const g of allGroups(after, opp)) {
    if (g.liberties.length > 2) continue;
    const doomed = !canEscape(after, g.stones[0], color);
    if (doomed) score += 400 * g.stones.length + 100;
    else if (g.liberties.length === 1) score += 30;
  }

  // 모양: 숨구멍 많고, 가장자리 피하기, 상대 숨구멍 줄이기
  const mine = getGroup(after.cells, after.size, m);
  score += Math.min(mine.liberties.length, 4) * 6;
  if (edgeDistance(pos.size, m) === 0) score -= 12;
  for (const n of neighbors(pos.size, m)) {
    if (after.cells[n] === opp) {
      score += 12 / getGroup(after.cells, after.size, n).liberties.length;
    }
  }
  return score + rng() * 4;
}

function tigerMove(pos: Position, color: Color, rng: Rng): number | null {
  const moves = legalMoves(pos, color);
  if (!moves.length) return null;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const s = scoreMove(pos, m, color, rng);
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}

export function chooseMove(
  pos: Position,
  color: Color,
  level: Level,
  rng: Rng = Math.random,
): number | null {
  switch (level) {
    case 'turtle': return turtleMove(pos, color, rng);
    case 'rabbit': return rabbitMove(pos, color, rng);
    case 'tiger': return tigerMove(pos, color, rng);
  }
}

export const AI_INFO: Record<Level, { name: string; emoji: string; desc: string }> = {
  turtle: { name: '아기 거북이', emoji: '🐢', desc: '느릿느릿, 처음 하는 친구에게 딱!' },
  rabbit: { name: '깡충 토끼', emoji: '🐰', desc: '잡을 수 있으면 잡고, 위험하면 도망가요.' },
  tiger: { name: '용감한 호랑이', emoji: '🐯', desc: '수를 미리 읽어요. 진짜 실력자 도전!' },
};
