import { useEffect, useRef, useState } from 'react';
import {
  BLACK,
  WHITE,
  emptyPosition,
  legalMoves,
  passMove,
  play,
  stonesInAtari,
  type Color,
  type MarkKind,
  type Position,
} from '../engine/go';
import { AI_INFO, chooseMove, type Level } from '../engine/ai';
import { Board, type CapturedStone } from '../components/Board';
import { Teacher } from '../components/Teacher';
import { saveProgress, type Progress } from '../lib/progress';
import { sounds } from '../lib/sound';
import { logEvent } from '../lib/log';

interface Settings {
  level: Level;
  board: BoardSize;
  target: number;
}

const LEVELS: Level[] = ['turtle', 'rabbit', 'tiger'];

/** 먼저 몇 개 잡으면 이길까 */
const TARGETS = [1, 3, 5, 7, 9, 10];

interface BoardSize {
  w: number;
  h: number;
  label: string;
}

/** 고를 수 있는 바둑판: 작은 판부터 큰 판까지 */
const BOARDS: BoardSize[] = [
  { w: 5, h: 5, label: '5줄' },
  { w: 7, h: 7, label: '7줄' },
  { w: 9, h: 9, label: '9줄' },
  { w: 12, h: 12, label: '12줄' },
  { w: 15, h: 15, label: '15줄' },
];

const AI_LINES: Record<Level, { capture: string; lose: string; win: string }> = {
  turtle: { capture: '앗, 내가 잡았네? 엉금엉금~', lose: '우와, 너 정말 잘한다!', win: '헤헤, 내가 이겼다! 한 판 더 할래?' },
  rabbit: { capture: '깡충! 잡았다!', lose: '으앙, 졌다! 너 진짜 대단해!', win: '깡충깡충! 다음엔 더 조심해 봐!' },
  tiger: { capture: '어흥! 잡았다!', lose: '어흥… 나를 이기다니! 바둑 왕이구나!', win: '어흥! 수를 미리 읽어 봐. 다시 도전!' },
};

export function PlayScreen({ progress, onProgress }: { progress: Progress; onProgress: (p: Progress) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  if (!settings) return <Setup progress={progress} onStart={setSettings} />;
  return <Game key={JSON.stringify(settings)} settings={settings} onProgress={onProgress} onExit={() => setSettings(null)} />;
}

function Setup({ progress, onStart }: { progress: Progress; onStart: (s: Settings) => void }) {
  const [level, setLevel] = useState<Level>('turtle');
  const [board, setBoard] = useState<BoardSize>(BOARDS[0]);
  const [target, setTarget] = useState<Settings['target']>(1);
  return (
    <div className="screen">
      <Teacher text="누구랑 대국할까요? 나는 흑돌, AI 친구는 백돌! 흑이 먼저 둬요." />
      <div className="ai-cards">
        {LEVELS.map((l) => (
          <button key={l} className={`ai-card ${level === l ? 'selected' : ''}`} onClick={() => setLevel(l)}>
            <span className="ai-emoji">{AI_INFO[l].emoji}</span>
            <span className="ai-name">{AI_INFO[l].name}</span>
            <span className="ai-desc">{AI_INFO[l].desc}</span>
            {progress.wins[l] > 0 && <span className="ai-wins">🏅 {progress.wins[l]}번 이김</span>}
          </button>
        ))}
      </div>
      <div className="options">
      <div className="option-row">
        <span className="option-label">바둑판</span>
        <div className="pills">
          {BOARDS.map((b) => (
            <button key={b.label} className={`pill ${board === b ? 'on' : ''}`} onClick={() => setBoard(b)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <div className="option-row">
        <span className="option-label">먼저 잡기</span>
        <div className="pills six">
          {TARGETS.map((t) => (
            <button key={t} className={`pill ${target === t ? 'on' : ''}`} onClick={() => setTarget(t)}>
              {t}
              <span className="unit">개</span>
            </button>
          ))}
        </div>
      </div>
      </div>
      <div className="row">
        <button className="btn primary big" onClick={() => onStart({ level, board, target })}>
          대국 시작! ▶
        </button>
      </div>
    </div>
  );
}

type Over = { winner: Color | null; reason: 'target' | 'nomoves' };

function Game({
  settings,
  onProgress,
  onExit,
}: {
  settings: Settings;
  onProgress: (p: Progress) => void;
  onExit: () => void;
}) {
  const { level, board, target } = settings;
  const { w, h } = board;
  const ai = AI_INFO[level];
  const [pos, setPos] = useState<Position>(() => emptyPosition(w, h));
  const [history, setHistory] = useState<Position[]>([]);
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [captured, setCaptured] = useState<CapturedStone[]>([]);
  const [animKey, setAnimKey] = useState(0);
  const [passes, setPasses] = useState(0);
  const [over, setOver] = useState<Over | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const [helper, setHelper] = useState(true);
  const recorded = useRef(false);

  const finish = (result: Over) => {
    setOver(result);
    logEvent('finish', result.winner === BLACK ? 'kidwin' : result.winner === WHITE ? 'botwin' : 'draw');
    // 마지막 돌 소리가 끝난 뒤에 결과 음악
    const fanfare = result.winner === BLACK ? sounds.win : result.winner === WHITE ? sounds.lose : sounds.draw;
    setTimeout(fanfare, 550);
    if (result.winner === BLACK) {
      if (!recorded.current) {
        recorded.current = true;
        onProgress(saveProgress((p) => ({ ...p, wins: { ...p.wins, [level]: p.wins[level] + 1 } })));
      }
    }
  };

  /** 한 수를 둔 뒤 공통 처리 */
  const applyMove = (from: Position, move: number, color: Color) => {
    const r = play(from, move, color);
    if (!r.ok) return false;
    setPos(r.pos);
    setLastMove(move);
    setPasses(0);
    setHint(null);
    sounds.stone(color === WHITE);
    if (r.captured.length) {
      setCaptured(r.captured.map((i) => ({ i, color: color === BLACK ? WHITE : BLACK })));
      setAnimKey((k) => k + 1);
      if (color === BLACK) sounds.capture(r.captured.length);
      else sounds.lost(r.captured.length);
    } else {
      setCaptured([]);
    }
    if (r.pos.captures[color] >= target) {
      finish({ winner: color, reason: 'target' });
    } else if (helper) {
      // 새로 단수가 된 돌이 있으면 소리로 알려 주기
      const newlyInAtari = (c: Color) => {
        const before = new Set(stonesInAtari(from, c));
        return stonesInAtari(r.pos, c).some((s) => !before.has(s));
      };
      if (color === WHITE && newlyInAtari(BLACK)) setTimeout(sounds.atari, 300);
      else if (color === BLACK && newlyInAtari(WHITE)) setTimeout(sounds.chance, 300);
    }
    return r;
  };

  const doPass = (from: Position) => {
    const nextPasses = passes + 1;
    setPos(passMove(from));
    sounds.pass();
    setPasses(nextPasses);
    setLastMove(null);
    if (nextPasses >= 2) {
      const b = from.captures[BLACK];
      const w = from.captures[WHITE];
      finish({ winner: b === w ? null : b > w ? BLACK : WHITE, reason: 'nomoves' });
    }
  };

  // 대국 시작 소리
  useEffect(() => {
    sounds.start();
    logEvent('start', level);
  }, [level]);

  // AI 차례
  useEffect(() => {
    if (over || pos.toPlay !== WHITE) return;
    const t = setTimeout(() => {
      const m = chooseMove(pos, WHITE, level);
      if (m === null) {
        setMessage(`${ai.emoji} 둘 곳이 없어서 한 번 쉴게!`);
        doPass(pos);
        return;
      }
      const r = applyMove(pos, m, WHITE);
      setMessage(r && r.captured.length ? `${ai.emoji} ${AI_LINES[level].capture}` : null);
    }, 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, over]);

  // 내 차례인데 둘 곳이 없으면 쉬기
  useEffect(() => {
    if (over || pos.toPlay !== BLACK) return;
    if (legalMoves(pos, BLACK).length === 0) {
      const t = setTimeout(() => {
        setMessage('둘 곳이 없어서 한 번 쉬어요.');
        doPass(pos);
      }, 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, over]);

  const myTurn = !over && pos.toPlay === BLACK;

  const onPlay = (i: number) => {
    if (!myTurn) return;
    const r = play(pos, i, BLACK);
    if (!r.ok) {
      sounds.wrong();
      setMessage(
        r.reason === 'occupied'
          ? '거기는 이미 돌이 있어요.'
          : r.reason === 'suicide'
            ? '거기는 숨구멍이 없어서 둘 수 없어요!'
            : '패! 바로 다시 따낼 수 없어요. 다른 곳에 먼저 두세요.',
      );
      return;
    }
    setHistory((h) => [...h, pos]);
    applyMove(pos, i, BLACK);
    setMessage(r.captured.length ? '와! 잡았어요! 🎉' : null);
  };

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setPos(prev);
    setOver(null);
    setLastMove(null);
    setCaptured([]);
    setHint(null);
    setPasses(0);
    sounds.undo();
    setMessage('한 수 물렀어요. 다시 생각해 봐요!');
  };

  const showHint = () => {
    if (!myTurn) return;
    const m = chooseMove(pos, BLACK, 'tiger');
    setHint(m);
    if (m !== null) sounds.hint();
    setMessage(m === null ? '둘 곳이 없어요.' : '노란 동그라미에 두면 좋아요!');
  };

  // 도움말: 단수 알려 주기
  const myAtari = stonesInAtari(pos, BLACK);
  const aiAtari = stonesInAtari(pos, WHITE);
  let status: string;
  if (over) {
    status =
      over.winner === BLACK
        ? `🎉 이겼어요! ${ai.emoji} "${AI_LINES[level].lose}"`
        : over.winner === WHITE
          ? `${ai.emoji} "${AI_LINES[level].win}"`
          : '비겼어요! 둘 다 잘했어요.';
  } else if (message) status = message;
  else if (!myTurn) status = `${ai.emoji} ${ai.name}가 생각 중이에요…`;
  else if (helper && myAtari.length) status = '⚠️ 내 돌이 단수예요! 빨간 돌을 이어서 도망가요!';
  else if (helper && aiAtari.length) status = '👀 백돌이 단수예요! 잡을 수 있어요!';
  else status = '내 차례예요. 어디에 둘까요?';

  const marks: Record<number, MarkKind> = {};
  if (hint !== null) marks[hint] = 'hint';

  return (
    <div className="screen game">
      <div className="scoreboard">
        <div className={`player ${pos.toPlay === BLACK && !over ? 'turn' : ''}`}>
          <span className="stone-icon black" /> 나
          <span className="caps">
            {target <= 5 && '●'.repeat(Math.min(pos.captures[BLACK], target))}
            <small>
              {pos.captures[BLACK]}/{target}
            </small>
          </span>
        </div>
        <div className="vs">VS</div>
        <div className={`player ${pos.toPlay === WHITE && !over ? 'turn' : ''}`}>
          <span className="stone-icon white" /> {ai.emoji} {ai.name}
          <span className="caps">
            {target <= 5 && '○'.repeat(Math.min(pos.captures[WHITE], target))}
            <small>
              {pos.captures[WHITE]}/{target}
            </small>
          </span>
        </div>
      </div>

      <Teacher
        text={status}
        face={over ? (over.winner === BLACK ? '🥳' : ai.emoji) : !myTurn ? ai.emoji : '🐼'}
        mood={over?.winner === BLACK ? 'happy' : 'talk'}
      />

      <div className="board-wrap" style={{ '--ar': w / h } as React.CSSProperties}>
        <Board
          w={w}
          h={h}
          cells={pos.cells}
          onPlay={onPlay}
          disabled={!myTurn}
          lastMove={lastMove}
          danger={helper ? [...myAtari, ...aiAtari] : []}
          captured={captured}
          animKey={animKey}
          marks={marks}
        />
        {over?.winner === BLACK && <Confetti />}
      </div>

      <div className="game-actions">
        {over ? (
          <>
            <button
              className="btn primary big"
              onClick={() => {
                recorded.current = false;
                sounds.start();
                logEvent('start', level);
                setPos(emptyPosition(w, h));
                setHistory([]);
                setOver(null);
                setLastMove(null);
                setCaptured([]);
                setMessage(null);
                setPasses(0);
              }}
            >
              🔄 한 판 더
            </button>
            <button className="btn big" onClick={onExit}>
              ⚙️ 상대 바꾸기
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={showHint} disabled={!myTurn}>
              💡 힌트
            </button>
            <button className="btn" onClick={undo} disabled={!history.length || !myTurn}>
              ↩️ 무르기
            </button>
            <button className={`btn ${helper ? 'on' : ''}`} onClick={() => setHelper((h) => !h)}>
              {helper ? '🛟 도우미 ON' : '🛟 도우미 OFF'}
            </button>
            <button className="btn" onClick={onExit}>
              ⚙️ 그만
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function Confetti() {
  const bits = ['🎉', '⭐', '🌟', '🎊', '✨', '🏆'];
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 24 }, (_, k) => (
        <span
          key={k}
          style={{ left: `${(k * 37) % 100}%`, animationDelay: `${(k % 8) * 0.15}s` }}
        >
          {bits[k % bits.length]}
        </span>
      ))}
    </div>
  );
}
