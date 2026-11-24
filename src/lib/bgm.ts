// 배경 음악 켜기/끄기 (설정은 이 기기에 저장). 브라우저는 사용자가 한 번 누른 뒤에만 소리를 낼 수 있어서,
// 켜져 있으면 첫 터치 때 시작한다. 화면이 숨겨지면 멈추고, 돌아오면 다시 튼다.
import { MusicPlayer } from './music';
import { getAudio } from './sound';

const KEY = 'baduk-music';
const player = new MusicPlayer(getAudio);
let enabled = true;
try {
  enabled = localStorage.getItem(KEY) !== '0';
} catch {
  /* ignore */
}
let unlocked = false;

export const isMusicOn = () => enabled;

function sync() {
  const shouldPlay = enabled && unlocked && document.visibilityState === 'visible';
  if (shouldPlay) player.start();
  else player.stop();
}

export function setMusicOn(v: boolean) {
  enabled = v;
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
  unlocked = true; // 버튼을 눌렀으니 소리 내기 가능
  sync();
}

/** 목소리(읽어 주기)가 나오는 동안 음악을 줄임 */
export const duckMusic = (on: boolean) => player.duck(on);

if (typeof document !== 'undefined') {
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    sync();
  };
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', sync);
}
