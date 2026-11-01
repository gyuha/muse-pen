import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cookieFrom, createTestApi, type TestApi } from './test-utils';

let t: TestApi;
beforeEach(() => { t = createTestApi(); });
afterEach(() => t.cleanup());

const signUp = (body: Record<string, unknown>) => t.client().req('POST', '/api/auth/sign-up/email', { password: 'password123', name: 'n', ...body });
const login = (email: string, password: string) => t.client().req('POST', '/api/auth/sign-in/email', { email, password });

describe('[AC-01] 초대 코드 가입', () => {
  it('코드가 없거나 무효하면 거절하고 계정을 만들지 않는다', async () => {
    expect((await signUp({ email: 'a@x.com' })).status).toBe(400);
    expect((await signUp({ email: 'a@x.com', inviteCode: 'nope' })).status).toBe(400);
    expect((await login('a@x.com', 'password123')).status).not.toBe(200);
    expect(t.api.services.repo.findAuthorByEmail('a@x.com')).toBeNull();
  });

  it('유효한 코드로 가입하면 로그인할 수 있고, 같은 코드는 다시 쓸 수 없다', async () => {
    const code = t.api.createInvite();
    expect((await signUp({ email: 'a@x.com', inviteCode: code })).status).toBe(200);
    const res = await login('a@x.com', 'password123');
    expect(res.status).toBe(200);
    const me = await t.client(cookieFrom(res)).json('GET', '/api/me');
    expect(me.body.email).toBe('a@x.com');

    expect((await signUp({ email: 'b@x.com', inviteCode: code })).status).toBe(400);
    expect(t.api.services.repo.findAuthorByEmail('b@x.com')).toBeNull();
    const used = t.api.services.repo.listInvites().find((i) => i.code === code)!;
    expect(used.usedAt).not.toBeNull();
    expect(used.usedByAuthorId).toBe(t.api.services.repo.findAuthorByEmail('a@x.com')!.id);
  });

  it('로그인하지 않으면 API는 401이다', async () => {
    expect((await t.client().json('GET', '/api/works')).status).toBe(401);
  });
});

describe('[AC-02] 관리자 비밀번호 재설정', () => {
  it('관리자는 재설정할 수 있고 새 비밀번호로만 로그인된다', async () => {
    const admin = await t.admin();
    const { client: author } = await t.signUp('w@x.com', 'oldpassword1');
    const authorId = t.api.services.repo.findAuthorByEmail('w@x.com')!.id;

    const res = await admin.json('POST', `/api/admin/authors/${authorId}/password`, { newPassword: 'newpassword1' });
    expect(res.status).toBe(204);
    expect((await login('w@x.com', 'oldpassword1')).status).not.toBe(200);
    expect((await login('w@x.com', 'newpassword1')).status).toBe(200);
    // 기존 세션은 끊긴다
    expect((await author.json('GET', '/api/me')).status).toBe(401);
  });

  it('일반 작가는 재설정할 수 없다', async () => {
    const { client: a } = await t.signUp('a@x.com');
    const { client: b } = await t.signUp('b@x.com', 'password123');
    const bId = t.api.services.repo.findAuthorByEmail('b@x.com')!.id;
    expect((await a.json('POST', `/api/admin/authors/${bId}/password`, { newPassword: 'hacked-password' })).status).toBe(403);
    expect((await login('b@x.com', 'hacked-password')).status).not.toBe(200);
    expect((await login('b@x.com', 'password123')).status).toBe(200);
    expect((await b.json('GET', '/api/admin/invites')).status).toBe(403);
  });

  it('관리자는 초대 코드를 발급하고 그 코드로 가입할 수 있다', async () => {
    const admin = await t.admin();
    const issued = await admin.json('POST', '/api/admin/invites', {});
    expect(issued.status).toBe(201);
    expect((await signUp({ email: 'n@x.com', inviteCode: issued.body.code })).status).toBe(200);
  });
});
