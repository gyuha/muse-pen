import { serve } from '@hono/node-server';
import { createApp } from './app';
import { selectTextProvider } from './text-provider';

// 환경 변수: PORT(3000), DB_PATH(./data/muse-pen.db), IMAGE_DIR(./data/images), BASE_URL, TRUSTED_ORIGINS(쉼표 구분),
// AUTH_SECRET(운영에서는 필수), ADMIN_EMAIL·ADMIN_PASSWORD(있으면 시작할 때 관리자 계정을 보장한다).
// TEXT_PROVIDER(fake 기본 | claude-code: 개발 전용, 본인 구독으로 claude -p 호출, 운영에서는 시작 거부).
// 공급자는 기본이 가짜라서 API 키 없이 기동한다.
const env = process.env;
const production = env.NODE_ENV === 'production';
if (production && !env.AUTH_SECRET) throw new Error('운영 환경에서는 AUTH_SECRET이 필요하다');

const port = Number(env.PORT ?? 3000);
const baseURL = env.BASE_URL ?? `http://localhost:${port}`;
const api = createApp({
  dbPath: env.DB_PATH ?? './data/muse-pen.db',
  imageDir: env.IMAGE_DIR ?? './data/images',
  authSecret: env.AUTH_SECRET ?? 'dev-only-secret-change-me-dev-only-secret',
  baseURL,
  textProvider: selectTextProvider(env),
  trustedOrigins: (env.TRUSTED_ORIGINS ?? `${baseURL},http://localhost:5173`).split(',').map((s) => s.trim()).filter(Boolean),
});

if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
  await api.createAdmin(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
}

const server = serve({ fetch: api.app.fetch, port }, (info) => console.log(`api listening on :${info.port}`));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    void api.close().then(() => process.exit(0));
  });
}
