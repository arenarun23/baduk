// 글을 소리 내어 읽어 주기 (한글을 아직 잘 못 읽는 친구를 위해)
import { duckMusic } from './bgm';
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string) {
  if (!canSpeak()) return;
  const clean = text.replace(/[\p{Extended_Pictographic}️]/gu, '').replace(/[①②③]/g, '');
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = 'ko-KR';
  u.rate = 0.9;
  u.pitch = 1.1;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('ko'));
  if (voice) u.voice = voice;
  // 읽어 주는 동안 배경 음악을 줄여서 잘 들리게
  duckMusic(true);
  u.onend = u.onerror = () => duckMusic(false);
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
  duckMusic(false);
}
