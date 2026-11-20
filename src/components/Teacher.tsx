import { useEffect } from 'react';
import { canSpeak, speak, stopSpeaking } from '../lib/speech';

const FACES = { talk: '🐼', happy: '🥳', oops: '🤔' } as const;

interface Props {
  text: string;
  mood?: keyof typeof FACES;
  face?: string;
}

export function Teacher({ text, mood = 'talk', face }: Props) {
  useEffect(() => stopSpeaking, []);
  return (
    <div className={`teacher mood-${mood}`}>
      <div className="teacher-face" aria-hidden>
        {face ?? FACES[mood]}
      </div>
      <div className="bubble">
        <p>{text}</p>
        {canSpeak() && (
          <button className="speak" onClick={() => speak(text)} aria-label="읽어 주기" title="읽어 주기">
            🔊
          </button>
        )}
      </div>
    </div>
  );
}
