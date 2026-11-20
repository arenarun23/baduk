import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { sounds } from './lib/sound';

// 버튼을 누르면 "톡" (정답 고르기 버튼은 정답/오답 소리가 따로 나요)
document.addEventListener('pointerdown', (e) => {
  const btn = (e.target as Element | null)?.closest?.('button');
  if (btn && !btn.disabled && !btn.classList.contains('choice')) sounds.tap();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
