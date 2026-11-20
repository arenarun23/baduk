import { useState } from 'react';
import { lessons } from '../data/lessons';
import { StepRunner } from '../components/StepRunner';
import { Teacher } from '../components/Teacher';
import { saveProgress, type Progress } from '../lib/progress';
import { sounds } from '../lib/sound';
import { go } from '../router';

export function LessonList({ progress }: { progress: Progress }) {
  const nextId = lessons.find((l) => !progress.lessonsDone.includes(l.id))?.id;
  return (
    <div className="screen">
      <Teacher text="무엇을 배워 볼까요? 위에서부터 차례대로 하면 좋아요!" />
      <div className="lesson-grid">
        {lessons.map((l, n) => {
          const done = progress.lessonsDone.includes(l.id);
          return (
            <button
              key={l.id}
              className={`lesson-card ${done ? 'done' : ''} ${l.id === nextId ? 'next' : ''}`}
              onClick={() => go(`/learn/${l.id}`)}
            >
              <span className="lesson-num">{n + 1}</span>
              <span className="lesson-emoji">{l.emoji}</span>
              <span className="lesson-title">{l.title}</span>
              {done && <span className="lesson-check">✔</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LessonScreen({ id, onProgress }: { id: string; onProgress: (p: Progress) => void }) {
  const index = lessons.findIndex((l) => l.id === id);
  const lesson = lessons[index];
  const [stepIdx, setStepIdx] = useState(0);
  const [complete, setComplete] = useState(false);

  if (!lesson) return <p>레슨을 찾을 수 없어요.</p>;
  const next = lessons[index + 1];

  if (complete) {
    return (
      <div className="screen center">
        <div className="celebrate">🌟</div>
        <Teacher text={`"${lesson.title}" 공부 끝! 정말 잘했어요!`} mood="happy" />
        <div className="row">
          {next ? (
            <button className="btn primary big" onClick={() => go(`/learn/${next.id}`)}>
              다음: {next.emoji} {next.title} ▶
            </button>
          ) : (
            <button className="btn primary big" onClick={() => go('/quiz')}>
              ✏️ 문제 풀러 가기
            </button>
          )}
          <button className="btn" onClick={() => go('/learn')}>
            📚 목록
          </button>
        </div>
      </div>
    );
  }

  const step = lesson.steps[stepIdx];
  const last = stepIdx === lesson.steps.length - 1;
  return (
    <div className="screen">
      <div className="lesson-head">
        <h2>
          {lesson.emoji} {lesson.title}
        </h2>
        <div className="dots">
          {lesson.steps.map((_, k) => (
            <span key={k} className={`dot ${k < stepIdx ? 'past' : k === stepIdx ? 'now' : ''}`} />
          ))}
        </div>
      </div>
      <StepRunner
        key={`${id}-${stepIdx}`}
        step={step}
        mode="lesson"
        nextLabel={last ? '레슨 끝! 🎉' : '다음 ▶'}
        onNext={() => {
          if (!last) return setStepIdx(stepIdx + 1);
          sounds.lessonDone();
          onProgress(
            saveProgress((p) => ({
              ...p,
              lessonsDone: p.lessonsDone.includes(lesson.id) ? p.lessonsDone : [...p.lessonsDone, lesson.id],
            })),
          );
          setComplete(true);
        }}
      />
    </div>
  );
}
