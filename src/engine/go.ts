// 바둑 규칙 엔진: 돌 놓기, 숨구멍(활로) 계산, 따내기, 착수 금지, 패.

export type Color = 1 | 2;
export type Cell = 0 | Color;

export const EMPTY = 0 as const;
export const BLACK = 1 as const;
export const WHITE = 2 as const;

export interface Position {
  size: number;
  cells: Cell[];
  toPlay: Color;
  /** 패 때문에 지금 둘 차례인 쪽이 둘 수 없는 자리 */
  ko: number | null;
  /** captures[color] = 그 색이 잡은 돌 수 (0번 칸은 쓰지 않음) */
  captures: [number, number, number];
}

export type IllegalReason = 'occupied' | 'suicide' | 'ko';

export type PlayResult =
  | { ok: true; pos: Position; captured: number[] }
  | { ok: false; reason: IllegalReason };

export interface Group {
  stones: number[];
  liberties: number[];
}

export const other = (c: Color): Color => (c === BLACK ? WHITE : BLACK);

export const toIndex = (size: number, x: number, y: number) => y * size + x;

export function emptyPosition(size: number, toPlay: Color = BLACK): Position {
  return {
    size,
    cells: new Array<Cell>(size * size).fill(EMPTY),
    toPlay,
    ko: null,
    captures: [0, 0, 0],
  };
}

export function neighbors(size: number, i: number): number[] {
  const x = i % size;
  const y = (i - x) / size;
  const out: number[] = [];
  if (y > 0) out.push(i - size);
  if (y < size - 1) out.push(i + size);
  if (x > 0) out.push(i - 1);
  if (x < size - 1) out.push(i + 1);
  return out;
}

/** i 자리 돌과 줄로 이어진 같은 색 돌 무리와 그 숨구멍 */
export function getGroup(cells: Cell[], size: number, i: number): Group {
  const color = cells[i];
  const stones: number[] = [];
  const liberties: number[] = [];
  if (color === EMPTY) return { stones, liberties };
  const seen = new Set<number>([i]);
  const libSeen = new Set<number>();
  const stack = [i];
  while (stack.length) {
    const cur = stack.pop()!;
    stones.push(cur);
    for (const n of neighbors(size, cur)) {
      const c = cells[n];
      if (c === EMPTY) {
        if (!libSeen.has(n)) {
          libSeen.add(n);
          liberties.push(n);
        }
      } else if (c === color && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return { stones, liberties };
}

/** 판 위의 모든 돌 무리 (색별) */
export function allGroups(pos: Position, color: Color): Group[] {
  const seen = new Set<number>();
  const groups: Group[] = [];
  pos.cells.forEach((c, i) => {
    if (c !== color || seen.has(i)) return;
    const g = getGroup(pos.cells, pos.size, i);
    g.stones.forEach((s) => seen.add(s));
    groups.push(g);
  });
  return groups;
}

export function play(pos: Position, i: number, color: Color = pos.toPlay): PlayResult {
  const { size } = pos;
  if (pos.cells[i] !== EMPTY) return { ok: false, reason: 'occupied' };
  if (color === pos.toPlay && pos.ko === i) return { ok: false, reason: 'ko' };

  const cells = pos.cells.slice();
  cells[i] = color;
  const opp = other(color);
  const captured: number[] = [];
  for (const n of neighbors(size, i)) {
    if (cells[n] !== opp) continue;
    const g = getGroup(cells, size, n);
    if (g.liberties.length === 0) {
      for (const s of g.stones) {
        cells[s] = EMPTY;
        captured.push(s);
      }
    }
  }

  const own = getGroup(cells, size, i);
  if (own.liberties.length === 0) return { ok: false, reason: 'suicide' };

  const ko =
    captured.length === 1 && own.stones.length === 1 && own.liberties.length === 1
      ? captured[0]
      : null;

  const captures: Position['captures'] = [...pos.captures];
  captures[color] += captured.length;

  return { ok: true, pos: { size, cells, toPlay: opp, ko, captures }, captured };
}

export function passMove(pos: Position): Position {
  return { ...pos, toPlay: other(pos.toPlay), ko: null };
}

export function isLegal(pos: Position, i: number, color: Color = pos.toPlay): boolean {
  return play(pos, i, color).ok;
}

export function legalMoves(pos: Position, color: Color = pos.toPlay): number[] {
  const out: number[] = [];
  for (let i = 0; i < pos.cells.length; i++) {
    if (pos.cells[i] === EMPTY && isLegal(pos, i, color)) out.push(i);
  }
  return out;
}

/** 단수(숨구멍 1개)에 걸린 돌들 */
export function stonesInAtari(pos: Position, color: Color): number[] {
  return allGroups(pos, color)
    .filter((g) => g.liberties.length === 1)
    .flatMap((g) => g.stones);
}

/**
 * 글자로 판 만들기.
 *  X = 흑, O = 백, . = 빈칸
 *  x / o = 눈여겨볼 흑/백 돌 (focus), ? = 눈여겨볼 빈칸 (focus)
 *  L = 숨구멍 표시, N = 둘 수 없음 표시, T = 별 표시 (모두 빈칸)
 */
export type MarkKind = 'liberty' | 'no' | 'target' | 'hint' | 'focus';

export interface ParsedBoard {
  pos: Position;
  focus: number | null;
  marks: Record<number, MarkKind>;
}

export function parseRows(rows: string[], toPlay: Color = BLACK): ParsedBoard {
  const size = rows.length;
  const pos = emptyPosition(size, toPlay);
  const marks: Record<number, MarkKind> = {};
  let focus: number | null = null;
  rows.forEach((row, y) => {
    const chars = row.replace(/\s+/g, '');
    if (chars.length !== size) throw new Error(`row ${y} has ${chars.length} cells, expected ${size}`);
    [...chars].forEach((ch, x) => {
      const i = toIndex(size, x, y);
      switch (ch) {
        case 'X': pos.cells[i] = BLACK; break;
        case 'O': pos.cells[i] = WHITE; break;
        case 'x': pos.cells[i] = BLACK; focus = i; break;
        case 'o': pos.cells[i] = WHITE; focus = i; break;
        case '?': focus = i; break;
        case 'L': marks[i] = 'liberty'; break;
        case 'N': marks[i] = 'no'; break;
        case 'T': marks[i] = 'target'; break;
        case '.': break;
        default: throw new Error(`unknown board char "${ch}"`);
      }
    });
  });
  return { pos, focus, marks };
}
