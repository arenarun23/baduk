import { useState } from 'react';
import { quiz } from '../data/quiz';
import type { Step } from '../data/steps';
import { StepRunner } from '../components/StepRunner';
import { Teacher } from '../components/Teacher';
import { saveProgress, type Progress } from '../lib/progress';
import { sounds } from '../lib/sound';
import { go } from '../router';

const shuffle = <T,>(arr: T[]): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function starsFor(score: number, total: number): number {
  const r = score / total;
  return r >= 0.9 ? 3 : r >= 0.65 ? 2 : r >= 0.4 ? 1 : 0;
}

export function QuizScreen({ onProgress }: { onProgress: (p: Progress) => void }) {
  const [questions, setQuestions] = useState<Step[]>(() => shuffle(quiz));
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const done = results.length === questions.length;
  const score = results.filter(Boolean).length;

  if (done) {
    const stars = starsFor(score, questions.length);
    const msg =
      stars === 3
        ? '최고예요! 바둑 박사님이네요! 이제 AI 친구와 대국해 봐요.'
        : stars === 2
          ? '잘했어요! 조금만 더 연습하면 만점이에요.'
          : '괜찮아요! 배우기를 한 번 더 보고 다시 도전해 봐요.';
    return (
      <div className="screen center">
        <div className="stars-big" aria-label={`별 ${stars}개`}>
          {[0, 1, 2].map((k) => (
            <span key={k} className={k < stars ? 'on' : 'off'}>
              ★
            </span>
          ))}
        </div>
        <h2 className="score">
          {questions.length}문제 중 {score}개 맞았어요!
        </h2>
        <Teacher text={msg} mood={stars >= 2 ? 'happy' : 'talk'} />
        <div className="row">
          <button
            className="btn primary big"
            onClick={() => {
              setQuestions(shuffle(quiz));
              setIdx(0);
              setResults([]);
            }}
          >
            🔄 다시 풀기
          </button>
          {stars >= 2 ? (
            <button className="btn big" onClick={() => go('/play')}>
              🎮 대국하기
            </button>
          ) : (
            <button className="btn big" onClick={() => go('/learn')}>
              📚 배우기
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="quiz-head">
        <h2>✏️ 문제 {idx + 1}</h2>
        <div className="quiz-progress">
          {questions.map((_, k) => (
            <span
              key={k}
              className={`qdot ${k < results.length ? (results[k] ? 'ok' : 'no') : k === idx ? 'now' : ''}`}
            >
              {k < results.length ? (results[k] ? '○' : '✕') : ''}
            </span>
          ))}
        </div>
      </div>
      <StepRunner
        key={idx}
        step={questions[idx]}
        mode="quiz"
        nextLabel={idx === questions.length - 1 ? '결과 보기 🏁' : '다음 문제 ▶'}
        onNext={(correct) => {
          const next = [...results, correct];
          setResults(next);
          if (next.length === questions.length) {
            const s = next.filter(Boolean).length;
            // 별이 하나씩 "딩, 딩, 딩" 나타나요
            const stars = starsFor(s, questions.length);
            for (let k = 0; k < stars; k++) setTimeout(() => sounds.star(k), 300 + k * 350);
            if (stars === 3) setTimeout(sounds.win, 300 + 3 * 350 + 200);
            else if (stars === 0) setTimeout(sounds.wrong, 300);
            onProgress(
              saveProgress((p) => ({
                ...p,
                quizTotal: questions.length,
                quizBest: Math.max(p.quizBest ?? 0, s),
              })),
            );
          } else {
            setIdx(idx + 1);
          }
        }}
      />
    </div>
  );
}
