// AIEDU 허브의 익명 이용 기록. 이벤트 종류와 짧은 영문 태그만 보낸다(아이의 답·입력은 보내지 않음).
// 허브 밖(단독 배포)에서는 aieduLog 가 없으므로 아무 일도 하지 않는다.
declare global {
  interface Window {
    aieduLog?: (event: 'start' | 'finish' | 'use', tag?: string) => void;
  }
}

export function logEvent(event: 'start' | 'finish' | 'use', tag: string) {
  try {
    window.aieduLog?.(event, tag.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20));
  } catch {
    /* 기록 실패는 무시 */
  }
}
