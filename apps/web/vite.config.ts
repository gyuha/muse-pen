import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // 운영의 Caddy와 같이 `/api` 접두사를 떼고 api(3000)로 넘긴다.
  server: { proxy: { '/api': { target: 'http://localhost:3000', rewrite: (path) => path.replace(/^\/api/, '') } } },
  test: { environment: 'jsdom' },
});
