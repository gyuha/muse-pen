import { createApp, type ApiApp, type CreateAppOptions } from '@muse-pen/api';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 수락 테스트용 하네스: api의 createApp(앱 팩토리)에 임시 DB·임시 이미지 디렉터리·가짜 공급자를 주입하고
// app.request()로 호출한다. api 내부 테스트 유틸(src/test-utils.ts)에 기대지 않고 직접 만든다.

const ORIGIN = 'http://localhost:3000';
const SECRET = 'accept-secret-accept-secret-accept-secret-1';

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

export const cookieFrom = (res: Response): string => res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

export interface Harness {
  api: ApiApp;
  dir: string;
  dbPath: string;
  imageDir: string;
  client(cookie?: string): Client;
  login(email: string, password: string): Promise<Client | null>;
  signUp(email: string, password?: string): Promise<Client>;
  admin(email?: string, password?: string): Promise<Client>;
  cleanup(): Promise<void>;
}

export function createHarness(options: Partial<CreateAppOptions> = {}, dir = mkdtempSync(join(tmpdir(), 'muse-accept-'))): Harness {
  const dbPath = join(dir, 'db.sqlite');
  const imageDir = join(dir, 'images');
  const api = createApp({ dbPath, imageDir, authSecret: SECRET, baseURL: ORIGIN, ...options });
  const client = (cookie = '') => makeClient(api, cookie);

  async function login(email: string, password: string): Promise<Client | null> {
    const res = await client().req('POST', '/api/auth/sign-in/email', { email, password });
    return res.status === 200 ? client(cookieFrom(res)) : null;
  }

  return {
    api, dir, dbPath, imageDir, client, login,
    async signUp(email, password = 'password123') {
      const inviteCode = api.createInvite();
      const res = await client().req('POST', '/api/auth/sign-up/email', { email, password, name: email.split('@')[0], inviteCode });
      if (res.status !== 200) throw new Error(`signUp ${email} -> ${res.status} ${await res.text()}`);
      const c = await login(email, password);
      if (!c) throw new Error(`login after signUp failed: ${email}`);
      return c;
    },
    async admin(email = 'admin@example.com', password = 'adminpass123') {
      await api.createAdmin(email, password);
      const c = await login(email, password);
      if (!c) throw new Error('admin login failed');
      return c;
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

export async function createWork(client: Client, title = '작품'): Promise<{ id: string; [k: string]: any }> {
  const r = await client.json('POST', '/api/works', { title, concept });
  if (r.status !== 201) throw new Error(`createWork ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

export const character = (name: string, over: Record<string, unknown> = {}) => ({
  kind: 'character', name, aliases: [] as string[], gender: '여', ageGroup: '20대', appearanceKeywords: ['흑발'],
  status: 'alive', representativeImageId: null, ...over,
});

export const location = (name: string, over: Record<string, unknown> = {}) => ({
  kind: 'location', name, placeType: '객잔', eraMoodKeywords: ['고풍'], representativeImageId: null, ...over,
});

export const prop = (name: string, over: Record<string, unknown> = {}) => ({
  kind: 'prop', name, ownerCharacterId: null, appearanceKeywords: ['검붉음'], representativeImageId: null, ...over,
});

export const world = (name: string, over: Record<string, unknown> = {}) => ({ kind: 'world', name, rulesSummary: '내공이 존재한다', ...over });

// 단락 블록 JSON 하나
export const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

export { rmSync };
