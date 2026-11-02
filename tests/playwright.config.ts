import { defineConfig } from '@playwright/test';
import { join } from 'node:path';

// AC-16 브라우저 E2E: api(임시 DB·가짜 공급자, 포트 3000)와 web(Vite dev, 5173)을 띄워 놓고 chromium으로 확인한다.
// 데이터 디렉터리는 .reports 아래(test:accept가 시작할 때 지운다)라서 실행마다 새 DB다.
const dataDir = join(import.meta.dirname, '.reports', 'e2e-data');

export const ADMIN_EMAIL = 'e2e-admin@example.com';
export const ADMIN_PASSWORD = 'e2e-admin-password-1';
export const API_URL = 'http://localhost:3000';
export const WEB_URL = 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  reporter: [['json', { outputFile: '.reports/playwright.json' }], ['list']],
  use: { baseURL: WEB_URL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: 'pnpm --filter @muse-pen/api start',
      url: `${API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: '3000',
        DB_PATH: join(dataDir, 'db.sqlite'),
        IMAGE_DIR: join(dataDir, 'images'),
        ADMIN_EMAIL,
        ADMIN_PASSWORD,
        AUTH_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-1',
      },
    },
    {
      command: 'pnpm --filter @muse-pen/web exec vite --port 5173 --strictPort',
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
