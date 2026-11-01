import { FakeImageProvider, type ImageProvider } from '@muse-pen/image-engine';
import { FakeSearchProvider, FakeTextProvider, type SearchProvider, type TextProvider } from '@muse-pen/story-engine';
import type { ImageStorage } from '@muse-pen/shared';
import { Hono } from 'hono';
import { randomBytes } from 'node:crypto';
import { createAuth } from './auth';
import { openDb } from './db/client';
import { genericBlockDeriver, type BlockDeriver } from './derive';
import { HttpError, type Env } from './http';
import { createJobHandlers } from './jobs';
import { DEFAULT_PRICING, estimateCost, type PricingTable } from './pricing';
import { Repository } from './repository';
import { newInviteCode } from './routes/admin';
import { apiRoutes } from './routes';
import type { Services } from './services';
import { LocalDiskImageStorage } from './storage';
import { newId, nowIso } from './util';
import { JobWorker } from './worker';

export interface CreateAppOptions {
  // SQLite 파일 경로(':memory:' 가능). 작업 기록이 재시작 후에도 남으려면 파일이어야 한다.
  dbPath: string;
  // 이미지 파일을 두는 디렉터리(로컬 디스크 저장소)
  imageDir: string;
  textProvider?: TextProvider;
  imageProvider?: ImageProvider;
  searchProvider?: SearchProvider;
  storage?: ImageStorage;
  deriver?: BlockDeriver;
  pricing?: PricingTable;
  authSecret?: string;
  baseURL?: string;
  trustedOrigins?: string[];
  // false면 워커를 켜지 않는다(시드 CLI 등). 기본 true.
  startWorker?: boolean;
}

export interface ApiApp {
  app: Hono<Env>;
  services: Services;
  // 관리자 계정을 만든다(이미 있으면 관리자 역할만 준다). 시드 CLI·테스트 부트스트랩용.
  createAdmin(email: string, password: string, name?: string): Promise<{ id: string; email: string }>;
  // 초대 코드를 발급한다(관리자 API와 같은 효과).
  createInvite(code?: string): string;
  // 등록된 작업이 모두 끝날 때까지 기다린다.
  whenJobsIdle(): Promise<void>;
  close(): Promise<void>;
}

export function createApp(options: CreateAppOptions): ApiApp {
  const handle = openDb(options.dbPath);
  const repo = new Repository(handle.db);
  const pricing = options.pricing ?? DEFAULT_PRICING;
  const baseURL = options.baseURL ?? 'http://localhost:3000';

  const auth = createAuth({
    db: handle.db,
    secret: options.authSecret ?? randomBytes(32).toString('base64url'),
    baseURL,
    trustedOrigins: options.trustedOrigins ?? [baseURL],
    claimInvite: (code) => repo.claimInvite(code),
    attachInvite: (code, authorId) => repo.attachInvite(code, authorId),
  });

  // eslint 없이 순환 참조를 풀기 위해 worker가 services를 늦게 읽는다.
  // eslint-disable-next-line prefer-const
  let services!: Services;
  const worker = new JobWorker(repo, createJobHandlers(() => services));
  services = {
    repo,
    auth,
    storage: options.storage ?? new LocalDiskImageStorage(options.imageDir),
    deriver: options.deriver ?? genericBlockDeriver,
    textProvider: options.textProvider ?? new FakeTextProvider(),
    imageProvider: options.imageProvider ?? new FakeImageProvider(),
    searchProvider: options.searchProvider ?? new FakeSearchProvider(),
    pricing,
    worker,
    recordUsage(authorId, feature, modelId, usage, costUsd) {
      repo.insertUsage({ id: newId(), authorId, feature, modelId, usage, estimatedCostUsd: costUsd ?? estimateCost(pricing, modelId, usage), createdAt: nowIso() });
    },
  };

  const app = new Hono<Env>();
  app.onError((error, c) => {
    if (error instanceof HttpError) return c.json({ error: error.message }, error.status);
    console.error(error);
    return c.json({ error: 'internal error' }, 500);
  });
  app.notFound((c) => c.json({ error: 'not found' }, 404));

  app.get('/api/health', (c) => c.json({ ok: true }));
  // 로그인·가입·로그아웃은 better-auth가 처리한다(/api/auth/*).
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

  app.use('/api/*', async (c, next) => {
    c.set('services', services);
    await next();
  });
  app.route('/api', apiRoutes);

  if (options.startWorker !== false) worker.start();

  return {
    app,
    services,
    createInvite(code) {
      return repo.createInvite(code ?? newInviteCode()).code;
    },
    async createAdmin(email, password, name = 'admin') {
      const existing = repo.findAuthorByEmail(email);
      if (existing) {
        repo.setAuthorRole(existing.id, 'admin');
        return { id: existing.id, email: existing.email };
      }
      const created = await auth.api.signUpEmail({ body: { email, password, name, inviteCode: repo.createInvite(newInviteCode()).code } as never });
      repo.setAuthorRole(created.user.id, 'admin');
      return { id: created.user.id, email: created.user.email };
    },
    whenJobsIdle: () => worker.idle(),
    async close() {
      await worker.stop();
      handle.close();
    },
  };
}
