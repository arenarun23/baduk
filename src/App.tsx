import { useState } from 'react';
import { lessons } from './data/lessons';
import { quiz } from './data/quiz';
import { loadProgress, type Progress } from './lib/progress';
import { isMuted, setMuted } from './lib/sound';
import { go, useRoute } from './router';
import { LessonList, LessonScreen } from './screens/Learn';
import { QuizScreen, starsFor } from './screens/Quiz';
import { PlayScreen } from './screens/Play';
import { OmokScreen } from './screens/Omok';
import { Teacher } from './components/Teacher';

export default function App() {
  const route = useRoute();
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [muted, setMutedState] = useState(isMuted);

  let page: React.ReactNode;
  switch (route[0]) {
    case 'learn':
      page = route[1] ? (
        <LessonScreen key={route[1]} id={route[1]} onProgress={setProgress} />
      ) : (
        <LessonList progress={progress} />
      );
      break;
    case 'quiz':
      page = <QuizScreen onProgress={setProgress} />;
      break;
    case 'play':
      page = <PlayScreen progress={progress} onProgress={setProgress} />;
      break;
    case 'omok':
      page = <OmokScreen progress={progress} onProgress={setProgress} />;
      break;
    default:
      page = <Home progress={progress} />;
  }

  const back = route.length === 0 ? null : route[0] === 'learn' && route[1] ? '/learn' : '/';

  return (
    <div className="app">
      <header className="topbar">
        {back ? (
          <button className="icon-btn" onClick={() => go(back)} aria-label="뒤로">
            {'\u25C0\uFE0E' /* ◀ 글자 모양(이모지 아님)이라 다크 모드에서 글자색을 따름 */}
          </button>
        ) : (
          <span className="icon-btn placeholder" />
        )}
        <button className="logo" onClick={() => go('/')}>
          <span className="logo-stones">⚫⚪</span> 꼬마 바둑 교실
        </button>
        <button
          className="icon-btn"
          onClick={() => {
            setMuted(!muted);
            setMutedState(!muted);
          }}
          aria-label={muted ? '소리 켜기' : '소리 끄기'}
        >
          {muted ? '🔇' : '🔔'}
        </button>
      </header>
      <main>{page}</main>
    </div>
  );
}

function Home({ progress }: { progress: Progress }) {
  const lessonCount = progress.lessonsDone.length;
  const quizStars =
    progress.quizBest === null ? null : starsFor(progress.quizBest, progress.quizTotal || quiz.length);
  const totalWins = progress.wins.turtle + progress.wins.rabbit + progress.wins.tiger;
  const omokWins = progress.omokWins.turtle + progress.omokWins.rabbit + progress.omokWins.tiger;
  const greeting =
    lessonCount === 0
      ? '안녕! 나는 판다 선생님이야. 같이 바둑을 배워 볼까? 먼저 "배우기"부터 시작해 봐!'
      : lessonCount < lessons.length
        ? '다시 왔구나! 배우기를 계속해 볼까?'
        : quizStars === null
          ? '배우기를 다 했어! 문제를 풀어서 확인해 봐!'
          : '이제 AI 친구들과 대국해 봐! 호랑이를 이길 수 있을까?';

  return (
    <div className="screen">
      <Teacher text={greeting} />
      <div className="menu">
        <button className="menu-card learn" onClick={() => go('/learn')}>
          <span className="menu-emoji">📚</span>
          <span className="menu-title">배우기</span>
          <span className="menu-sub">바둑 규칙을 하나씩</span>
          <span className="menu-meter">
            <span style={{ width: `${(lessonCount / lessons.length) * 100}%` }} />
          </span>
          <span className="menu-badge">
            {lessonCount}/{lessons.length} 완료
          </span>
        </button>
        <button className="menu-card quiz" onClick={() => go('/quiz')}>
          <span className="menu-emoji">✏️</span>
          <span className="menu-title">문제 풀기</span>
          <span className="menu-sub">배운 것을 확인해요</span>
          <span className="menu-badge stars">
            {quizStars === null
              ? '아직 안 풀었어요'
              : [0, 1, 2].map((k) => (
                  <span key={k} className={k < quizStars ? 'on' : 'off'}>
                    ★
                  </span>
                ))}
          </span>
        </button>
        <button className="menu-card play" onClick={() => go('/play')}>
          <span className="menu-emoji">🎮</span>
          <span className="menu-title">AI와 대국</span>
          <span className="menu-sub">🐢 🐰 🐯 친구들과 따먹기 바둑</span>
          <span className="menu-badge">{totalWins > 0 ? `🏅 ${totalWins}번 이겼어요` : '첫 승리에 도전!'}</span>
        </button>
        <button className="menu-card omok" onClick={() => go('/omok')}>
          <span className="menu-emoji">🖐️</span>
          <span className="menu-title">오목 놀이</span>
          <span className="menu-sub">돌 5개를 먼저 나란히!</span>
          <span className="menu-badge">{omokWins > 0 ? `🏅 ${omokWins}번 이겼어요` : '12줄 판에서 도전!'}</span>
        </button>
      </div>
    </div>
  );
}
