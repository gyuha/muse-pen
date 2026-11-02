import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, type ApiApp, type CreateAppOptions } from './app';

const ORIGIN = 'http://localhost:3000';

export interface TestApi {
  api: ApiApp;
  dir: string;
  dbPath: string;
  imageDir: string;
  client(cookie?: string): Client;
  signUp(email: string, password?: string): Promise<{ cookie: string; client: Client }>;
  admin(email?: string, password?: string): Promise<Client>;
  cleanup(): Promise<void>;
}

export interface Client {
  cookie: string;
  req(method: string, path: string, body?: unknown): Promise<Response>;
  json<T = any>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }>;
}

export function makeClient(api: ApiApp, cookie = ''): Client {
  const req = (method: string, path: string, body?: unknown) =>
    Promise.resolve(
      api.app.request(path, {
        method,
        headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    );
  return {
    cookie,
    req,
    async json(method, path, body) {
      const res = await req(method, path, body);
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    },
  };
}

export function cookieFrom(res: Response): string {
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

export function createTestApi(options: Partial<CreateAppOptions> = {}, dir = mkdtempSync(join(tmpdir(), 'muse-api-'))): TestApi {
  const dbPath = join(dir, 'db.sqlite');
  const imageDir = join(dir, 'images');
  const api = createApp({ dbPath, imageDir, authSecret: 'test-secret-test-secret-test-secret-1234', baseURL: ORIGIN, ...options });
  const client = (cookie = '') => makeClient(api, cookie);

  async function login(email: string, password: string): Promise<Client> {
    const res = await client().req('POST', '/api/auth/sign-in/email', { email, password });
    if (res.status !== 200) throw new Error(`login failed ${res.status}`);
    return client(cookieFrom(res));
  }

  return {
    api, dir, dbPath, imageDir, client,
    async signUp(email, password = 'password123') {
      const inviteCode = api.createInvite();
      const res = await client().req('POST', '/api/auth/sign-up/email', { email, password, name: email.split('@')[0], inviteCode });
      if (res.status !== 200) throw new Error(`signUp failed ${res.status} ${await res.text()}`);
      const c = await login(email, password);
      return { cookie: c.cookie, client: c };
    },
    async admin(email = 'admin@example.com', password = 'adminpass123') {
      await api.createAdmin(email, password);
      return login(email, password);
    },
    async cleanup() {
      await api.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export interface SseEvent { event: string; data: any }
export function parseSse(text: string): SseEvent[] {
  return text.split('\n\n').filter((b) => b.trim()).map((block) => {
    const lines = block.split('\n');
    const event = lines.find((l) => l.startsWith('event:'))?.slice(6).trim() ?? 'message';
    const data = lines.filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
    return { event, data: data ? JSON.parse(data) : null };
  });
}

export const concept = {
  genre: '무협', tone: '건조', pointOfView: 'third_person', targetReader: '20대',
  artStylePreset: { prompt: '수묵화', referenceImageIds: [] as string[] },
};

export async function createWork(client: Client, title = '작품') {
  const r = await client.json('POST', '/api/works', { title, concept });
  if (r.status !== 201) throw new Error(`createWork ${r.status} ${JSON.stringify(r.body)}`);
  return r.body as { id: string };
}

export const character = (name: string, over: Record<string, unknown> = {}) => ({
  kind: 'character', name, aliases: [], gender: '여', ageGroup: '20대', appearanceKeywords: ['흑발'], status: 'alive', representativeImageId: null, ...over,
});
