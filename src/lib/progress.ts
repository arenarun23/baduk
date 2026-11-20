// 공부한 기록 (이 기기의 브라우저에만 저장돼요)
import type { Level } from '../engine/ai';

export interface Progress {
  lessonsDone: string[];
  quizBest: number | null;
  quizTotal: number;
  wins: Record<Level, number>;
}

const KEY = 'baduk-progress-v1';
const fresh = (): Progress => ({
  lessonsDone: [],
  quizBest: null,
  quizTotal: 0,
  wins: { turtle: 0, rabbit: 0, tiger: 0 },
});

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const p = JSON.parse(raw) as Partial<Progress>;
    return { ...fresh(), ...p, wins: { ...fresh().wins, ...p.wins } };
  } catch {
    return fresh();
  }
}

export function saveProgress(update: (p: Progress) => Progress): Progress {
  const next = update(loadProgress());
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
