import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './': AIEDU 허브의 하위 경로(/baduk/)에서도 열리도록 상대경로로 빌드
export default defineConfig({
  base: './',
  plugins: [react()],
});
