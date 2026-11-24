import { useEffect, useState } from 'react';
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

/**
 * 삼성 인터넷은 다크 모드에서 페이지 색을 강제로 바꾼다(검은 돌 → 회색, 흰 돌 → 연회색).
 * 개발자가 끌 방법이 없지만 컬러 이모지 글자는 건드리지 않으므로, 그때만 돌을 ⚫⚪ 이모지로 그린다.
 */
const DARK_QUERY = '(prefers-color-scheme: dark)';
function isSamsungDark(): boolean {
  if (typeof navigator === 'undefined' || !/SamsungBrowser/i.test(navigator.userAgent)) return false;
  try {
    return matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}
function useEmojiStones(): boolean {
  const [on, setOn] = useState(isSamsungDark);
  useEffect(() => {
    if (!/SamsungBrowser/i.test(navigator.userAgent)) return;
    const mq = matchMedia(DARK_QUERY);
    const f = () => setOn(isSamsungDark());
    mq.addEventListener?.('change', f);
    return () => mq.removeEventListener?.('change', f);
  }, []);
  // 시험용: 주소에 ?emoji=1 을 붙이면 다른 브라우저에서도 이모지 돌
  return on || /[?&]emoji=1/.test(location.search + location.hash);
}

/**
 * 돌 한 개. 보통은 단색 원(+작은 광택) — 그라데이션은 강제 다크 모드에서 색이 뒤집혀서 쓰지 않는다.
 * emoji 가 켜지면 ⚫⚪ 컬러 이모지로 그린다(삼성 인터넷 다크 모드).
 */
function Stone({ x, y, black, shadow = false, emoji = false }: { x: number; y: number; black: boolean; shadow?: boolean; emoji?: boolean }) {
  if (emoji) {
    return (
      <text x={x} y={y} className="stone-emoji" textAnchor="middle" dominantBaseline="central" fontSize={STONE_R * 1.72}>
        {black ? '⚫' : '⚪'}
      </text>
    );
  }
  return (
    <g filter={shadow ? 'url(#shadow)' : undefined}>
      <circle cx={x} cy={y} r={STONE_R} className={black ? 'stone-black' : 'stone-white'} />
      <circle
        cx={x - STONE_R * 0.32}
        cy={y - STONE_R * 0.36}
        r={STONE_R * 0.3}
        className={black ? 'stone-shine-black' : 'stone-shine-white'}
      />
    </g>
  );
}

/**
 * 점수판의 작은 돌 표시. 컬러 이모지(⚫⚪)를 쓴다 — 삼성 인터넷 '어둡게 보기'가
 * 작은 SVG·배경색은 색을 뒤집지만 컬러 이모지 글자는 그대로 두기 때문이다.
 */
export function StoneIcon({ black }: { black: boolean }) {
  return (
    <span className="stone-icon" aria-hidden="true">
      {black ? '⚫' : '⚪'}
    </span>
  );
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
  const emoji = useEmojiStones();
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
            <Stone x={x} y={y} black={c === 1} shadow emoji={emoji} />
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
            <Stone x={x} y={y} black={color === 1} emoji={emoji} />
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
