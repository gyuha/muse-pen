import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { Env } from '../http';
import { adminRoutes } from './admin';
import { aiRoutes } from './ai';
import { episodesRoutes } from './episodes';
import { imagesRoutes } from './images';
import { jobsRoutes } from './jobs';
import { resourcesRoutes } from './resources';
import { settingsRoutes } from './settings';
import { worksRoutes } from './works';

// 로그인한 작가만 통과시키고 작가 정보를 컨텍스트에 싣는다. services는 createApp이 먼저 싣는다.
const requireAuthor = createMiddleware<Env>(async (c, next) => {
  const session = await c.get('services').auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'unauthorized' }, 401);
  c.set('author', { id: session.user.id, email: session.user.email, role: (session.user as { role?: string }).role ?? 'user' });
  await next();
});

// Hono RPC 타입 추론을 위해 라우트는 모두 체이닝으로 정의한다.
export const apiRoutes = new Hono<Env>()
  .use('*', requireAuthor)
  .get('/me', (c) => c.json(c.get('author')))
  .get('/usage', (c) => c.json(c.get('services').repo.listUsage(c.get('author').id)))
  .route('/', worksRoutes)
  .route('/', episodesRoutes)
  .route('/', settingsRoutes)
  .route('/', resourcesRoutes)
  .route('/', aiRoutes)
  .route('/', jobsRoutes)
  .route('/', imagesRoutes)
  .route('/', adminRoutes);

// web이 `hc<AppType>('/')`로 쓰는 타입. 경로는 /api/... 그대로다.
// better-auth가 처리하는 /api/auth/*와 /api/health는 타입에 없다.
export const rpcApp = new Hono<Env>().route('/api', apiRoutes);
export type AppType = typeof rpcApp;
