import { useMemo, useState } from 'react';
import { BLACK, getGroup, parseRows, play, type MarkKind, type Position } from '../engine/go';
import { countAnswer, defaultChoices, meetsGoal, oxAnswer, solutions, type Step } from '../data/steps';
import { sounds } from '../lib/sound';
import { Board, type CapturedStone } from './Board';
import { Teacher } from './Teacher';

interface Props {
  step: Step;
  /** lesson: 맞을 때까지 다시 / quiz: 한 번에 채점 */
  mode: 'lesson' | 'quiz';
  onNext: (correct: boolean) => void;
  nextLabel?: string;
}

type Feedback = { correct: boolean; text: string } | null;

const ILLEGAL_TEXT = {
  occupied: '거기는 이미 돌이 있어요.',
  suicide: '거기는 숨구멍이 없어서 둘 수 없어요.',
  ko: '패! 바로 다시 따낼 수는 없어요.',
};

export function StepRunner({ step, mode, onNext, nextLabel = '다음 ▶' }: Props) {
  const parsed = useMemo(() => (step.rows ? parseRows(step.rows) : null), [step]);
  const [pos, setPos] = useState<Position | null>(parsed?.pos ?? null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [firstTryCorrect, setFirstTryCorrect] = useState<boolean | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [captured, setCaptured] = useState<CapturedStone[]>([]);
  const [chosen, setChosen] = useState<number | boolean | null>(null);

  const finished = step.kind === 'info' || feedback?.correct === true || (mode === 'quiz' && feedback !== null);

  const recordAnswer = (correct: boolean) => {
    if (firstTryCorrect === null) setFirstTryCorrect(correct);
    if (!correct) setWrongCount((n) => n + 1);
  };

  // ----- 바둑판 표시 -----
  const marks: Record<number, MarkKind> = { ...(parsed?.marks ?? {}) };
  if (parsed?.focus != null) marks[parsed.focus] = 'focus';
  if (step.kind === 'move' && showAnswer && feedback?.correct !== true) {
    for (const s of solutions(step.rows, step.goal)) marks[s] = 'hint';
  }
  if (step.kind === 'count' && finished && parsed?.focus != null && pos) {
    for (const l of getGroup(pos.cells, pos.size, parsed.focus).liberties) marks[l] = 'liberty';
  }
  if (step.kind === 'ox' && finished && parsed?.focus != null && !oxAnswer(step.rows)) {
    marks[parsed.focus] = 'no';
  }

  // ----- 돌 놓기 문제 -----
  const onPlay = (i: number) => {
    if (step.kind !== 'move' || !pos || finished) return;
    const r = play(pos, i, BLACK);
    if (!r.ok) {
      sounds.wrong();
      setFeedback({ correct: false, text: ILLEGAL_TEXT[r.reason] });
      if (r.reason !== 'occupied') recordAnswer(false);
      if (mode === 'quiz' && r.reason !== 'occupied') {
        setShowAnswer(true);
        setFeedback({ correct: false, text: `${ILLEGAL_TEXT[r.reason]} 노란 동그라미가 정답이에요.` });
      }
      return;
    }
    if (meetsGoal(pos, i, step.goal)) {
      recordAnswer(true);
      setPos(r.pos);
      setLastMove(i);
      setCaptured(r.captured.map((c) => ({ i: c, color: 2 })));
      sounds.stone();
      if (r.captured.length) sounds.capture(r.captured.length);
      setTimeout(() => sounds.correct(), r.captured.length ? 550 : 250);
      setFeedback({ correct: true, text: step.success });
      return;
    }
    sounds.wrong();
    recordAnswer(false);
    if (mode === 'quiz') {
      setShowAnswer(true);
      setFeedback({ correct: false, text: '아쉬워요! 노란 동그라미가 정답이에요.' });
    } else {
      const tip = step.hint ?? '노란 동그라미를 잘 보세요!';
      if (wrongCount >= 1) setShowAnswer(true);
      setFeedback({ correct: false, text: `다시 해 볼까요? ${wrongCount >= 1 ? tip : ''}` });
    }
  };

  // ----- 고르기 문제 (숫자 / ⭕❌) -----
  const onChoose = (value: number | boolean, correct: boolean, explain: string) => {
    if (finished) return;
    setChosen(value);
    recordAnswer(correct);
    if (correct) {
      sounds.correct();
      setFeedback({ correct: true, text: `정답! ${explain}` });
    } else {
      sounds.wrong();
      if (mode === 'quiz') setFeedback({ correct: false, text: `아쉬워요! ${explain}` });
      else setFeedback({ correct: false, text: wrongCount >= 1 ? `힌트: ${explain}` : '다시 골라 볼까요?' });
    }
  };

  const teacherText = feedback ? feedback.text : step.text;

  return (
    <div className="step">
      <Teacher text={teacherText} mood={feedback ? (feedback.correct ? 'happy' : 'oops') : 'talk'} />
      {feedback && <p className="question-again">{step.kind !== 'info' && step.text}</p>}

      {pos && (
        <div className="board-wrap">
          <Board
            size={pos.size}
            cells={pos.cells}
            marks={marks}
            onPlay={step.kind === 'move' ? onPlay : undefined}
            disabled={finished}
            lastMove={lastMove}
            captured={captured}
            animKey={lastMove ?? 0}
          />
        </div>
      )}

      {step.kind === 'count' && (
        <div className="choices">
          {(step.choices ?? defaultChoices).map((n) => {
            const answer = countAnswer(step.rows);
            const state = finished && n === answer ? 'right' : chosen === n ? (n === answer ? 'right' : 'wrong') : '';
            return (
              <button
                key={n}
                className={`choice ${state}`}
                disabled={finished}
                onClick={() => onChoose(n, n === answer, step.explain)}
              >
                {n}개
              </button>
            );
          })}
        </div>
      )}

      {step.kind === 'ox' && (
        <div className="choices">
          {[true, false].map((v) => {
            const answer = oxAnswer(step.rows);
            const state = finished && v === answer ? 'right' : chosen === v ? (v === answer ? 'right' : 'wrong') : '';
            return (
              <button
                key={String(v)}
                className={`choice ox ${state}`}
                disabled={finished}
                onClick={() => onChoose(v, v === answer, step.explain)}
              >
                {v ? '⭕ 놓을 수 있어요' : '❌ 놓을 수 없어요'}
              </button>
            );
          })}
        </div>
      )}

      <div className="step-actions">
        {step.kind === 'move' && !finished && mode === 'lesson' && (
          <button className="btn ghost" onClick={() => setShowAnswer(true)}>
            💡 힌트
          </button>
        )}
        {finished && (
          <button className="btn primary big" onClick={() => onNext(firstTryCorrect ?? true)} autoFocus>
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
