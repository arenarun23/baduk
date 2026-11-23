import { useState } from 'react';
import type { Cell, Color, MarkKind } from '../engine/go';

const CELL = 100;
const PAD = 64;
const STONE_R = 46;

/** 화점(별 자리): 7줄은 가운데, 9줄 이상은 네 귀(가장자리에서 2~3줄 안)와 가운데(홀수 줄일 때), 17줄 이상 홀수 판은 변 가운데도 */
function starPoints(w: number, h: number): [number, number][] {
  const m = Math.min(w, h);
  if (m < 7) return [];
  const center: [number, number][] = w % 2 && h % 2 ? [[(w - 1) / 2, (h - 1) / 2]] : [];
  if (m < 9) return center;
  const e = m >= 12 ? 3 : 2;
  const corners: [number, number][] = [[e, e], [w - 1 - e, e], [e, h - 1 - e], [w - 1 - e, h - 1 - e]];
  // 17줄 이상 홀수 판(19줄 등): 변의 가운데 화점 4개도 (모두 9개)
  const sides: [number, number][] =
    m >= 17 && center.length
      ? [[(w - 1) / 2, e], [(w - 1) / 2, h - 1 - e], [e, (h - 1) / 2], [w - 1 - e, (h - 1) / 2]]
      : [];
  return [...corners, ...sides, ...center];
}

export interface CapturedStone {
  i: number;
  color: Color;
}

interface Props {
  /** 가로 줄 수 */
  w: number;
  /** 세로 줄 수 */
  h: number;
  cells: Cell[];
  onPlay?: (i: number) => void;
  marks?: Record<number, MarkKind>;
  lastMove?: number | null;
  /** 단수(위험)인 돌들: 빨갛게 반짝 */
  danger?: number[];
  /** 방금 잡혀서 사라지는 돌들 */
  captured?: CapturedStone[];
  /** 잡힌 돌 애니메이션을 다시 시작하기 위한 값 */
  animKey?: number;
  disabled?: boolean;
  ghost?: Color;
  /** 반짝이는 노란 테두리를 칠 돌들 (오목에서 이긴 줄) */
  highlight?: number[];
}

export function Board({
  w,
  h,
  cells,
  onPlay,
  marks = {},
  lastMove = null,
  danger = [],
  captured = [],
  animKey = 0,
  disabled = false,
  ghost = 1,
  highlight = [],
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const spanX = (w - 1) * CELL;
  const spanY = (h - 1) * CELL;
  const fullX = spanX + PAD * 2;
  const fullY = spanY + PAD * 2;
  const pt = (i: number) => ({ x: PAD + (i % w) * CELL, y: PAD + Math.floor(i / w) * CELL });
  const dangerSet = new Set(danger);
  const interactive = !!onPlay && !disabled;

  return (
    <svg
      className={`board ${interactive ? 'interactive' : ''}`}
      viewBox={`0 0 ${fullX} ${fullY}`}
      role="grid"
      aria-label={w === h ? `${w}줄 바둑판` : `가로 ${w}줄 세로 ${h}줄 바둑판`}
    >
      <defs>
        <radialGradient id="g-black" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#6b6b6b" />
          <stop offset="45%" stopColor="#262626" />
          <stop offset="100%" stopColor="#050505" />
        </radialGradient>
        <radialGradient id="g-white" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#ecebe6" />
          <stop offset="100%" stopColor="#c9c6bc" />
        </radialGradient>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="3" dy="5" stdDeviation="3" floodOpacity="0.35" />
        </filter>
      </defs>

      <rect x="0" y="0" width={fullX} height={fullY} rx="28" className="board-wood" />

      <g className="board-line">
        {Array.from({ length: h }, (_, k) => (
          <line key={`r${k}`} x1={PAD} y1={PAD + k * CELL} x2={PAD + spanX} y2={PAD + k * CELL} />
        ))}
        {Array.from({ length: w }, (_, k) => (
          <line key={`c${k}`} x1={PAD + k * CELL} y1={PAD} x2={PAD + k * CELL} y2={PAD + spanY} />
        ))}
      </g>
      {starPoints(w, h).map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={PAD + x * CELL} cy={PAD + y * CELL} r="9" className="star-point" />
      ))}

      {/* 표시: 숨구멍, 둘 수 없음, 별, 힌트, 눈여겨보기 */}
      {Object.entries(marks).map(([k, kind]) => {
        const i = Number(k);
        const { x, y } = pt(i);
        switch (kind) {
          case 'liberty':
            return <circle key={`m${i}`} cx={x} cy={y} r="17" className="mark-liberty" />;
          case 'no':
            return (
              <g key={`m${i}`} className="mark-no">
                <line x1={x - 20} y1={y - 20} x2={x + 20} y2={y + 20} />
                <line x1={x + 20} y1={y - 20} x2={x - 20} y2={y + 20} />
              </g>
            );
          case 'target':
            return (
              <text key={`m${i}`} x={x} y={y + 14} className="mark-target" textAnchor="middle">
                ⭐
              </text>
            );
          case 'hint':
            return <circle key={`m${i}`} cx={x} cy={y} r="40" className="mark-hint" />;
          case 'focus':
            return cells[i] === 0 ? (
              <text key={`m${i}`} x={x} y={y + 18} className="mark-question" textAnchor="middle">
                ?
              </text>
            ) : null;
        }
      })}

      {/* 돌 */}
      {cells.map((c, i) => {
        if (c === 0) return null;
        const { x, y } = pt(i);
        return (
          <g key={`s${i}-${c}`} className="stone-in">
            <circle cx={x} cy={y} r={STONE_R} fill={`url(#g-${c === 1 ? 'black' : 'white'})`} filter="url(#shadow)" />
            {lastMove === i && <circle cx={x} cy={y} r="12" className={c === 1 ? 'last-on-black' : 'last-on-white'} />}
            {dangerSet.has(i) && <circle cx={x} cy={y} r={STONE_R + 5} className="danger-ring" />}
            {highlight.includes(i) && <circle cx={x} cy={y} r={STONE_R + 6} className="win-ring" />}
            {marks[i] === 'focus' && <circle cx={x} cy={y} r={STONE_R + 6} className="focus-ring" />}
          </g>
        );
      })}

      {/* 잡혀서 사라지는 돌 */}
      {captured.map(({ i, color }) => {
        const { x, y } = pt(i);
        return (
          <g key={`c${animKey}-${i}`} className="stone-out" style={{ transformOrigin: `${x}px ${y}px` }}>
            <circle cx={x} cy={y} r={STONE_R} fill={`url(#g-${color === 1 ? 'black' : 'white'})`} />
            <text x={x} y={y + 16} textAnchor="middle" className="pop-star">✨</text>
          </g>
        );
      })}

      {/* 마우스를 올리면 흐린 돌 */}
      {interactive && hover !== null && cells[hover] === 0 && (
        <circle {...(({ x, y }) => ({ cx: x, cy: y }))(pt(hover))} r={STONE_R} className={`ghost ghost-${ghost}`} />
      )}

      {/* 누르는 곳 (손가락으로 누르기 좋게 크게) */}
      {interactive &&
        cells.map((_, i) => {
          const { x, y } = pt(i);
          return (
            <rect
              key={`h${i}`}
              x={x - CELL / 2}
              y={y - CELL / 2}
              width={CELL}
              height={CELL}
              className="hit"
              role="gridcell"
              aria-label={`왼쪽에서 ${(i % w) + 1}번째, 위에서 ${Math.floor(i / w) + 1}번째`}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(i)}
              onPointerLeave={() => setHover((h) => (h === i ? null : h))}
              onClick={() => onPlay?.(i)}
            />
          );
        })}
    </svg>
  );
}
