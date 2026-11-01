import type { CreateWorkInput, SettingFields, SettingKind, Setting, Work } from '@muse-pen/shared';

// api 라우트가 `/api/...`로 시작하고, 프록시(Vite 개발·운영 Caddy)가 바깥 `/api` 접두사를 떼므로 `/api/api`가 된다.
// api가 AppType을 export하지 않아 Hono RPC(hc) 대신 타입을 맞춘 얇은 fetch 래퍼를 쓴다.
const BASE = '/api/api';

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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageOf(data, res.status));
  return data as T;
}

export interface Me {
  id: string;
  email: string;
  role: string;
}

export const api = {
  me: () => request<Me>('GET', '/me'),
  signIn: (email: string, password: string) => request<unknown>('POST', '/auth/sign-in/email', { email, password }),
  // 가입은 자동 로그인되지 않는다(api가 autoSignIn을 끈다).
  signUp: (input: { email: string; password: string; name: string; inviteCode: string }) => request<unknown>('POST', '/auth/sign-up/email', input),
  signOut: () => request<unknown>('POST', '/auth/sign-out', {}),
  listWorks: () => request<Work[]>('GET', '/works'),
  getWork: (workId: string) => request<Work>('GET', `/works/${encodeURIComponent(workId)}`),
  createWork: (input: CreateWorkInput) => request<Work>('POST', '/works', input),
  listSettings: (workId: string, kind: SettingKind) => request<Setting[]>('GET', `/works/${encodeURIComponent(workId)}/settings?kind=${kind}`),
  createSetting: (workId: string, fields: SettingFields) => request<Setting>('POST', `/works/${encodeURIComponent(workId)}/settings`, fields),
};
