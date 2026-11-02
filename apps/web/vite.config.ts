import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // api 라우트가 이미 `/api/...`라서 접두사를 떼지 않고 그대로 api(3000)로 넘긴다(운영 Caddy도 동일).
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: { environment: 'jsdom' },
});
