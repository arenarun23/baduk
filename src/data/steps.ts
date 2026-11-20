// 배우기·문제 풀기에서 쓰는 한 단계(한 화면)의 종류와 정답 판정
import {
  BLACK,
  WHITE,
  allGroups,
  getGroup,
  legalMoves,
  parseRows,
  play,
  stonesInAtari,
  type Position,
} from '../engine/go';

export type Goal =
  | 'any' //       아무 곳에나 두기
  | 'capture' //   백돌 잡기
  | 'atari' //     백돌을 단수로 만들기
  | 'escape'; //   단수인 흑돌 살리기

export type Step =
  | { kind: 'info'; text: string; rows?: string[] }
  | { kind: 'move'; text: string; rows: string[]; goal: Goal; success: string; hint?: string }
  | { kind: 'count'; text: string; rows: string[]; choices?: number[]; explain: string }
  | { kind: 'ox'; text: string; rows: string[]; explain: string };

/** 흑이 m 에 뒀을 때 목표를 이뤘는지 */
export function meetsGoal(pos: Position, m: number, goal: Goal): boolean {
  const r = play(pos, m, BLACK);
  if (!r.ok) return false;
  const after = r.pos;
  switch (goal) {
    case 'any':
      return true;
    case 'capture':
      return r.captured.length > 0;
    case 'atari': {
      const myLibs = getGroup(after.cells, after.size, m).liberties.length;
      return myLibs >= 2 && allGroups(after, WHITE).some((g) => g.liberties.length === 1);
    }
    case 'escape': {
      const endangered = stonesInAtari(pos, BLACK);
      if (!endangered.length) return false;
      return endangered.every(
        (s) => after.cells[s] === BLACK && getGroup(after.cells, after.size, s).liberties.length >= 2,
      );
    }
  }
}

export function solutions(rows: string[], goal: Goal): number[] {
  const { pos } = parseRows(rows);
  return legalMoves(pos, BLACK).filter((m) => meetsGoal(pos, m, goal));
}

/** count 문제의 정답: 눈여겨볼 돌의 숨구멍 수 */
export function countAnswer(rows: string[]): number {
  const { pos, focus } = parseRows(rows);
  if (focus === null) throw new Error('count step needs a focus stone (x or o)');
  return getGroup(pos.cells, pos.size, focus).liberties.length;
}

/** ox 문제의 정답: 눈여겨볼 빈칸에 흑돌을 둘 수 있는지 */
export function oxAnswer(rows: string[]): boolean {
  const { pos, focus } = parseRows(rows);
  if (focus === null) throw new Error('ox step needs a focus point (?)');
  return play(pos, focus, BLACK).ok;
}

export const defaultChoices = [1, 2, 3, 4];
