import { useEffect, useRef, useState } from 'react';
import { BLACK, WHITE, type Cell, type Color, type MarkKind } from '../engine/go';
import { AI_INFO, type Level } from '../engine/ai';
import { OMOK_AI_DESC, OMOK_SIZE, chooseOmokMove, winningLine, winningMoves } from '../engine/omok';
import { Board } from '../components/Board';
import { Teacher } from '../components/Teacher';
import { saveProgress, type Progress } from '../lib/progress';
import { sounds } from '../lib/sound';
import { logEvent } from '../lib/log';
import { Confetti } from './Play';

const D = { w: OMOK_SIZE, h: OMOK_SIZE };
const LEVELS: Level[] = ['turtle', 'rabbit', 'tiger'];
const RULE = '가로·세로·대각선으로 내 돌 5개를 먼저 나란히 놓으면 이겨요!';

const LINES: Record<Level, { win: string; lose: string }> = {
  turtle: { win: '헤헤, 내가 5개 만들었다! 한 판 더 할래?', lose: '우와, 5개를 만들었네! 정말 잘한다!' },
  rabbit: { win: '깡충! 내가 먼저 5개! 백돌 4개는 꼭 막아 봐!', lose: '으앙, 졌다! 너 오목 잘하는구나!' },
  tiger: { win: '어흥! 3개가 열려 있을 때부터 막아야 해!', lose: '어흥… 나를 이기다니! 오목 왕이구나!' },
};

export function OmokScreen({ progress, onProgress }: { progress: Progress; onProgress: (p: Progress) => void }) {
  const [level, setLevel] = useState<Level | null>(null);
  if (!level) return <Setup progress={progress} onStart={setLevel} />;
  return <Game key={level} level={level} onProgress={onProgress} onExit={() => setLevel(null)} />;
}

function Setup({ progress, onStart }: { progress: Progress; onStart: (l: Level) => void }) {
  const [level, setLevel] = useState<Level>('turtle');
  return (
    <div className="screen">
      <Teacher text={`오목 놀이! ${RULE} 나는 흑돌, 흑이 먼저 둬요.`} />
      <div className="ai-cards">
        {LEVELS.map((l) => (
          <button key={l} className={`ai-card ${level === l ? 'selected' : ''}`} onClick={() => setLevel(l)}>
            <span className="ai-emoji">{AI_INFO[l].emoji}</span>
            <span className="ai-name">{AI_INFO[l].name}</span>
            <span className="ai-desc">{OMOK_AI_DESC[l]}</span>
            {progress.omokWins[l] > 0 && <span className="ai-wins">🏅 {progress.omokWins[l]}번 이김</span>}
          </button>
        ))}
      </div>
      <div className="row">
        <button className="btn primary big" onClick={() => onStart(level)}>
          오목 시작! ▶
        </button>
      </div>
    </div>
  );
}

type Over = { winner: Color | null; line: number[] };

const emptyCells = (): Cell[] => new Array<Cell>(D.w * D.h).fill(0);

function Game({ level, onProgress, onExit }: { level: Level; onProgress: (p: Progress) => void; onExit: () => void }) {
  const ai = AI_INFO[level];
  const [cells, setCells] = useState<Cell[]>(emptyCells);
  const [toPlay, setToPlay] = useState<Color>(BLACK);
  const [history, setHistory] = useState<Cell[][]>([]);
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [over, setOver] = useState<Over | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const [helper, setHelper] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const recorded = useRef(false);

  useEffect(() => {
    sounds.start();
    logEvent('start', `omok-${level}`);
  }, [level]);

  const finish = (result: Over) => {
    setOver(result);
    logEvent('finish', result.winner === BLACK ? 'omok-kidwin' : result.winner === WHITE ? 'omok-botwin' : 'omok-draw');
    const fanfare = result.winner === BLACK ? sounds.win : result.winner === WHITE ? sounds.lose : sounds.draw;
    setTimeout(fanfare, 450);
    if (result.winner === BLACK && !recorded.current) {
      recorded.current = true;
      onProgress(saveProgress((p) => ({ ...p, omokWins: { ...p.omokWins, [level]: p.omokWins[level] + 1 } })));
    }
  };

  /** 돌을 놓고 승패·도우미 소리 처리 */
  const place = (from: Cell[], m: number, color: Color) => {
    const next = from.slice();
    next[m] = color;
    setCells(next);
    setLastMove(m);
    setHint(null);
    sounds.stone(color === WHITE);
    const line = winningLine(next, D, m);
    if (line) return finish({ winner: color, line });
    if (!next.includes(0)) return finish({ winner: null, line: [] });
    setToPlay(color === BLACK ? WHITE : BLACK);
    if (helper) {
      if (color === WHITE && winningMoves(next, D, WHITE).length) setTimeout(sounds.atari, 300);
      else if (color === WHITE && winningMoves(next, D, BLACK).length) setTimeout(sounds.chance, 300);
    }
  };

  // AI 차례
  useEffect(() => {
    if (over || toPlay !== WHITE) return;
    const t = setTimeout(() => {
      const m = chooseOmokMove(cells, D, WHITE, level);
      if (m === null) return finish({ winner: null, line: [] });
      setMessage(null);
      place(cells, m, WHITE);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toPlay, over]);

  const myTurn = !over && toPlay === BLACK;

  const onPlay = (i: number) => {
    if (!myTurn) return;
    if (cells[i] !== 0) {
      sounds.wrong();
      setMessage('거기는 이미 돌이 있어요.');
      return;
    }
    setHistory((h) => [...h, cells]);
    setMessage(null);
    place(cells, i, BLACK);
  };

  const undo = () => {
    if (!history.length || !myTurn) return;
    setCells(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setLastMove(null);
    setHint(null);
    sounds.undo();
    setMessage('한 수 물렀어요. 다시 생각해 봐요!');
  };

  const showHint = () => {
    if (!myTurn) return;
    const m = chooseOmokMove(cells, D, BLACK, 'tiger');
    setHint(m);
    if (m !== null) sounds.hint();
    setMessage('노란 동그라미에 두면 좋아요!');
  };

  const restart = () => {
    recorded.current = false;
    sounds.start();
    logEvent('start', `omok-${level}`);
    setCells(emptyCells());
    setToPlay(BLACK);
    setHistory([]);
    setLastMove(null);
    setOver(null);
    setHint(null);
    setMessage(null);
  };

  // 안내 문구
  const aiFour = myTurn && helper ? winningMoves(cells, D, WHITE) : [];
  const myFour = myTurn && helper ? winningMoves(cells, D, BLACK) : [];
  let status: string;
  if (over) {
    status =
      over.winner === BLACK
        ? `🎉 5개 완성! 이겼어요! ${ai.emoji} "${LINES[level].lose}"`
        : over.winner === WHITE
          ? `${ai.emoji} "${LINES[level].win}"`
          : '바둑판이 꽉 찼어요. 비겼어요!';
  } else if (message) status = message;
  else if (!myTurn) status = `${ai.emoji} ${ai.name}가 생각 중이에요…`;
  else if (myFour.length) status = '👀 한 번 더 두면 5개! 이길 수 있는 곳을 찾아봐요!';
  else if (aiFour.length) status = '⚠️ 백돌이 5개를 만들려고 해요! 얼른 막아요!';
  else status = `내 차례예요. ${RULE}`;

  const marks: Record<number, MarkKind> = {};
  if (hint !== null) marks[hint] = 'hint';

  return (
    <div className="screen game">
      <div className="scoreboard">
        <div className={`player ${toPlay === BLACK && !over ? 'turn' : ''}`}>
          <span className="stone-icon black" /> 나
        </div>
        <div className="vs">VS</div>
        <div className={`player ${toPlay === WHITE && !over ? 'turn' : ''}`}>
          <span className="stone-icon white" /> {ai.emoji} {ai.name}
        </div>
      </div>

      <Teacher
        text={status}
        face={over ? (over.winner === BLACK ? '🥳' : ai.emoji) : !myTurn ? ai.emoji : '🐼'}
        mood={over?.winner === BLACK ? 'happy' : 'talk'}
      />

      <div className="board-wrap">
        <Board
          w={D.w}
          h={D.h}
          cells={cells}
          onPlay={onPlay}
          disabled={!myTurn}
          lastMove={lastMove}
          marks={marks}
          highlight={over?.line ?? []}
        />
        {over?.winner === BLACK && <Confetti />}
      </div>

      <div className="game-actions">
        {over ? (
          <>
            <button className="btn primary big" onClick={restart}>
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
            <button className={`btn ${helper ? 'on' : ''}`} onClick={() => setHelper((v) => !v)}>
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
