import type { AppType } from '@muse-pen/api';
import type { CreateWorkInput, SettingFields, SettingKind } from '@muse-pen/shared';
import { hc } from 'hono/client';

// api의 Hono RPC 타입으로 호출한다. 경로는 `/api/...` 한 번만이고, 개발은 Vite 프록시가 운영은 Caddy가 그대로 api로 넘긴다.
const client = hc<AppType>('/');
// better-auth가 처리하는 /api/auth/*는 RPC 타입 밖이라 fetch를 직접 쓴다.
const AUTH = '/api/auth';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function messageOf(data: unknown, status: number): string {
  const body = (data ?? {}) as { message?: unknown; error?: unknown };
  if (typeof body.message === 'string' && body.message) return body.message;
  if (body.error === 'validation') return '입력이 올바르지 않습니다.';
  if (typeof body.error === 'string' && body.error) return body.error;
  return `요청에 실패했습니다 (${status})`;
}

async function toError(res: Response): Promise<ApiError> {
  return new ApiError(res.status, messageOf(await res.json().catch(() => null), res.status));
}

async function auth(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${AUTH}${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw await toError(res);
}

export interface Me {
  id: string;
  email: string;
  role: string;
}

// 응답 유니온(검증 실패 400 등)은 res.ok로 성공만 좁힌다.
export const api = {
  async me() {
    const res = await client.api.me.$get();
    if (!res.ok) throw await toError(res);
    return res.json();
  },
  signIn: (email: string, password: string) => auth('/sign-in/email', { email, password }),
  // 가입은 자동 로그인되지 않는다(api가 autoSignIn을 끈다).
  signUp: (input: { email: string; password: string; name: string; inviteCode: string }) => auth('/sign-up/email', input),
  signOut: () => auth('/sign-out', {}),
  async listWorks() {
    const res = await client.api.works.$get();
    if (!res.ok) throw await toError(res);
    return res.json();
  },
  async getWork(workId: string) {
    const res = await client.api.works[':workId'].$get({ param: { workId } });
    if (!res.ok) throw await toError(res);
    return res.json();
  },
  async createWork(input: CreateWorkInput) {
    const res = await client.api.works.$post({ json: input });
    if (!res.ok) throw await toError(res);
    return res.json();
  },
  async listSettings(workId: string, kind: SettingKind) {
    const res = await client.api.works[':workId'].settings.$get({ param: { workId }, query: { kind } });
    if (!res.ok) throw await toError(res);
    return res.json();
  },
  async createSetting(workId: string, fields: SettingFields) {
    const res = await client.api.works[':workId'].settings.$post({ param: { workId }, json: fields });
    if (!res.ok) throw await toError(res);
    return res.json();
  },
};
