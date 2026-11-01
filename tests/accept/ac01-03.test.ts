import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { character, createHarness, createWork, para, type Client, type Harness } from './helpers';

let t: Harness;
beforeEach(() => { t = createHarness(); });
afterEach(() => t.cleanup());

const signUpRaw = (email: string, body: Record<string, unknown> = {}) =>
  t.client().req('POST', '/api/auth/sign-up/email', { email, password: 'password123', name: 'n', ...body });

describe('[AC-01] 초대 코드 가입', () => {
  it('[AC-01] 초대 코드가 없으면 가입이 거절되고 계정이 만들어지지 않는다', async () => {
    const res = await signUpRaw('nocode@x.com');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(t.api.services.repo.findAuthorByEmail('nocode@x.com')).toBeFalsy();
    expect(await t.login('nocode@x.com', 'password123')).toBeNull();
  });

  it('[AC-01] 빈 문자열 초대 코드도 거절된다', async () => {
    const res = await signUpRaw('empty@x.com', { inviteCode: '' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(t.api.services.repo.findAuthorByEmail('empty@x.com')).toBeFalsy();
  });

  it('[AC-01] 존재하지 않는(무효) 초대 코드는 거절되고 계정이 만들어지지 않는다', async () => {
    const res = await signUpRaw('bad@x.com', { inviteCode: 'NOT-A-REAL-CODE' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(t.api.services.repo.findAuthorByEmail('bad@x.com')).toBeFalsy();
    expect(await t.login('bad@x.com', 'password123')).toBeNull();
  });

  it('[AC-01] 유효한 코드로 가입하면 같은 이메일·비밀번호로 로그인할 수 있고 /api/me가 그 작가를 돌려준다', async () => {
    const code = t.api.createInvite();
    const res = await signUpRaw('ok@x.com', { inviteCode: code });
    expect(res.status).toBe(200);
    expect(t.api.services.repo.findAuthorByEmail('ok@x.com')).toBeTruthy();
    const c = await t.login('ok@x.com', 'password123');
    expect(c).not.toBeNull();
    const me = await c!.json('GET', '/api/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: 'ok@x.com', role: 'user' });
  });

  it('[AC-01] 잘못된 비밀번호로는 로그인되지 않는다', async () => {
    await t.signUp('pw@x.com');
    expect(await t.login('pw@x.com', 'wrong-password')).toBeNull();
  });

  it('[AC-01] 인증 없이 보호된 API를 부르면 401이다', async () => {
    const res = await t.client().json('GET', '/api/works');
    expect(res.status).toBe(401);
  });

  it('[AC-01] 같은 코드는 다시 쓸 수 없다: 두 번째 가입은 거절되고 첫 작가의 계정은 그대로다', async () => {
    const code = t.api.createInvite();
    expect((await signUpRaw('first@x.com', { inviteCode: code })).status).toBe(200);
    const second = await signUpRaw('second@x.com', { inviteCode: code });
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(t.api.services.repo.findAuthorByEmail('second@x.com')).toBeFalsy();
    expect(await t.login('second@x.com', 'password123')).toBeNull();
    expect(await t.login('first@x.com', 'password123')).not.toBeNull();
  });

  it('[AC-01] 사용된 초대 코드는 관리자 목록에서 사용한 작가와 연결된다', async () => {
    const admin = await t.admin();
    const created = await admin.json('POST', '/api/admin/invites', {});
    expect(created.status).toBe(201);
    const code = created.body.code as string;
    await signUpRaw('user@x.com', { inviteCode: code });
    const list = (await admin.json('GET', '/api/admin/invites')).body as any[];
    const row = list.find((i) => i.code === code);
    expect(row).toBeTruthy();
    const author = t.api.services.repo.findAuthorByEmail('user@x.com')!;
    expect(JSON.stringify(row)).toContain(author.id);
  });
});

describe('[AC-02] 관리자 비밀번호 재설정', () => {
  it('[AC-02] 관리자가 재설정하면 새 비밀번호로만 로그인된다(이전 비밀번호는 거절)', async () => {
    const author = await t.signUp('writer@x.com', 'old-password-1');
    const admin = await t.admin();
    const id = (await author.json('GET', '/api/me')).body.id as string;
    const res = await admin.req('POST', `/api/admin/authors/${id}/password`, { newPassword: 'brand-new-pass-9' });
    expect(res.status).toBe(204);
    expect(await t.login('writer@x.com', 'old-password-1')).toBeNull();
    expect(await t.login('writer@x.com', 'brand-new-pass-9')).not.toBeNull();
  });

  it('[AC-02] 재설정 뒤 작가의 기존 세션은 더 이상 유효하지 않다', async () => {
    const author = await t.signUp('writer@x.com', 'old-password-1');
    expect((await author.json('GET', '/api/me')).status).toBe(200);
    const admin = await t.admin();
    const id = (await author.json('GET', '/api/me')).body.id as string;
    await admin.req('POST', `/api/admin/authors/${id}/password`, { newPassword: 'brand-new-pass-9' });
    expect((await author.json('GET', '/api/me')).status).toBe(401);
  });

  it('[AC-02] 일반 작가는 재설정할 수 없다(403)이고 대상 비밀번호는 바뀌지 않는다', async () => {
    const victim = await t.signUp('victim@x.com', 'victim-pass-1');
    const attacker = await t.signUp('attacker@x.com', 'attacker-pass-1');
    const victimId = (await victim.json('GET', '/api/me')).body.id as string;
    const attackerId = (await attacker.json('GET', '/api/me')).body.id as string;

    const r1 = await attacker.json('POST', `/api/admin/authors/${victimId}/password`, { newPassword: 'hacked-pass-123' });
    expect(r1.status).toBe(403);
    const r2 = await attacker.json('POST', `/api/admin/authors/${attackerId}/password`, { newPassword: 'hacked-pass-123' });
    expect(r2.status).toBe(403);
    expect(await t.login('victim@x.com', 'hacked-pass-123')).toBeNull();
    expect(await t.login('victim@x.com', 'victim-pass-1')).not.toBeNull();
    expect(await t.login('attacker@x.com', 'attacker-pass-1')).not.toBeNull();
  });

  it('[AC-02] 비로그인 호출은 401이고, 일반 작가는 관리자 목록·초대 발급도 못 한다', async () => {
    const author = await t.signUp('w@x.com');
    const id = (await author.json('GET', '/api/me')).body.id as string;
    expect((await t.client().json('POST', `/api/admin/authors/${id}/password`, { newPassword: 'whatever-123' })).status).toBe(401);
    expect((await author.json('GET', '/api/admin/authors')).status).toBe(403);
    expect((await author.json('POST', '/api/admin/invites', {})).status).toBe(403);
    expect((await author.json('GET', '/api/admin/usage')).status).toBe(403);
  });

  it('[AC-02] 너무 짧은 새 비밀번호는 거절되고 기존 비밀번호가 유지된다', async () => {
    const author = await t.signUp('w@x.com', 'keep-this-pass-1');
    const admin = await t.admin();
    const id = (await author.json('GET', '/api/me')).body.id as string;
    const res = await admin.json('POST', `/api/admin/authors/${id}/password`, { newPassword: 'short' });
    expect(res.status).toBe(400);
    expect(await t.login('w@x.com', 'keep-this-pass-1')).not.toBeNull();
  });
});

// --- AC-03 ---

interface Fixture { w: string; e: string; s: string; r: string; imageId: string; storageKey: string }

async function seedOwnerData(a: Client): Promise<Fixture> {
  const w = await createWork(a, 'A의 작품');
  const e = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: 'A의 회차', bodyJson: [para('A의 비밀 본문')] })).body;
  const s = (await a.json('POST', `/api/works/${w.id}/settings`, character('하린'))).body;
  const r = (await a.json('POST', `/api/works/${w.id}/resources`, { title: 'A의 자료', summary: '요약' })).body;
  const job = (await a.json('POST', `/api/works/${w.id}/settings/${s.id}/images`, {})).body;
  await t.api.whenJobsIdle();
  const imageId = (await a.json('GET', `/api/jobs/${job.id}`)).body.result.imageId as string;
  const image = t.api.services.repo.getImage(imageId)!;
  return { w: w.id, e: e.id, s: s.id, r: r.id, imageId, storageKey: image.storageKey };
}

describe('[AC-03] 작가 간 소유권 격리', () => {
  let a: Client;
  let b: Client;
  let f: Fixture;
  beforeEach(async () => {
    a = await t.signUp('a@x.com');
    b = await t.signUp('b@x.com');
    f = await seedOwnerData(a);
  });

  it('[AC-03] 작품: B는 A의 작품을 조회·수정·삭제할 수 없고 목록에도 안 보인다. A의 작품은 그대로다', async () => {
    const base = `/api/works/${f.w}`;
    expect((await b.json('GET', base)).status).toBe(404);
    expect((await b.json('PATCH', base, { title: '탈취' })).status).toBe(404);
    expect((await b.json('DELETE', base)).status).toBe(404);
    expect((await b.json('GET', `${base}/synopsis`)).status).toBe(404);
    expect((await b.json('PUT', `${base}/synopsis`, { content: '탈취' })).status).toBe(404);
    expect((await b.json('GET', '/api/works')).body).toEqual([]);
    const mine = (await a.json('GET', base)).body;
    expect(mine.title).toBe('A의 작품');
    expect((await a.json('GET', `${base}/synopsis`)).body.content).toBe('');
  });

  it('[AC-03] 회차: B는 A의 회차를 조회·수정·삭제·스냅샷·AI 호출·생성할 수 없다. A의 회차는 그대로다', async () => {
    const base = `/api/works/${f.w}/episodes`;
    expect((await b.json('GET', base)).status).toBe(404);
    expect((await b.json('POST', base, { title: '침입' })).status).toBe(404);
    expect((await b.json('GET', `${base}/${f.e}`)).status).toBe(404);
    expect((await b.json('PATCH', `${base}/${f.e}`, { title: '탈취' })).status).toBe(404);
    expect((await b.json('DELETE', `${base}/${f.e}`)).status).toBe(404);
    expect((await b.json('POST', `${base}/${f.e}/snapshots`)).status).toBe(404);
    expect((await b.json('GET', `${base}/${f.e}/snapshots`)).status).toBe(404);
    expect((await b.json('PUT', `${base}/${f.e}/plot-memo`, { content: 'x' })).status).toBe(404);
    expect((await b.json('POST', `${base}/${f.e}/ai/continue`, { textBefore: 'x' })).status).toBe(404);
    const eps = (await a.json('GET', base)).body as any[];
    expect(eps).toHaveLength(1);
    expect(eps[0]).toMatchObject({ title: 'A의 회차', bodyText: 'A의 비밀 본문' });
  });

  it('[AC-03] 설정: B는 A의 설정을 조회·수정·삭제·생성할 수 없다. A의 설정은 그대로다', async () => {
    const base = `/api/works/${f.w}/settings`;
    expect((await b.json('GET', base)).status).toBe(404);
    expect((await b.json('POST', base, character('침입'))).status).toBe(404);
    expect((await b.json('GET', `${base}/${f.s}`)).status).toBe(404);
    expect((await b.json('PATCH', `${base}/${f.s}`, { name: '탈취' })).status).toBe(404);
    expect((await b.json('DELETE', `${base}/${f.s}`)).status).toBe(404);
    const list = (await a.json('GET', base)).body as any[];
    expect(list.map((s) => s.name)).toEqual(['하린']);
  });

  it('[AC-03] 자료: B는 A의 자료를 조회·수정·삭제·생성할 수 없다. A의 자료는 그대로다', async () => {
    const base = `/api/works/${f.w}/resources`;
    expect((await b.json('GET', base)).status).toBe(404);
    expect((await b.json('POST', base, { title: '침입' })).status).toBe(404);
    expect((await b.json('GET', `${base}/${f.r}`)).status).toBe(404);
    expect((await b.json('PATCH', `${base}/${f.r}`, { title: '탈취' })).status).toBe(404);
    expect((await b.json('DELETE', `${base}/${f.r}`)).status).toBe(404);
    const list = (await a.json('GET', base)).body as any[];
    expect(list.map((r) => r.title)).toEqual(['A의 자료']);
  });

  it('[AC-03] 이미지: B는 A의 이미지 기록·파일을 받거나 승인·삭제할 수 없고, 이미지 생성도 요청할 수 없다. A는 계속 받을 수 있다', async () => {
    const url = `/api/image-files/${f.storageKey}`;
    expect((await b.json('GET', `/api/images/${f.imageId}`)).status).toBe(404);
    expect((await b.req('GET', url)).status).toBe(404);
    expect((await b.json('POST', `/api/images/${f.imageId}/approve`)).status).toBe(404);
    expect((await b.json('DELETE', `/api/images/${f.imageId}`)).status).toBe(404);
    expect((await b.json('GET', `/api/works/${f.w}/settings/${f.s}/images`)).status).toBe(404);
    expect((await b.json('POST', `/api/works/${f.w}/settings/${f.s}/images`, {})).status).toBe(404);

    // A의 이미지는 그대로: 기록·파일·다운로드 모두 유효
    expect(existsSync(join(t.imageDir, f.storageKey))).toBe(true);
    expect(t.api.services.repo.getImage(f.imageId)).toBeTruthy();
    const res = await a.req('GET', url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await res.arrayBuffer()).slice(0, 4)).toEqual(new Uint8Array([137, 80, 78, 71]));
  });

  it('[AC-03] 작업(job): B는 A의 작업을 조회·재요청할 수 없다', async () => {
    const jobs = (await a.json('GET', `/api/works/${f.w}/jobs`)).body as any[];
    expect(jobs.length).toBeGreaterThan(0);
    expect((await b.json('GET', `/api/jobs/${jobs[0].id}`)).status).toBe(404);
    expect((await b.json('POST', `/api/jobs/${jobs[0].id}/retry`)).status).toBe(404);
    expect((await b.json('GET', `/api/works/${f.w}/jobs`)).status).toBe(404);
  });

  it('[AC-03] B 자신의 자원은 B만 쓰고, 같은 작가라도 다른 작품 경로로 자식 자원에 접근하면 404다', async () => {
    const bw = await createWork(b, 'B의 작품');
    expect((await b.json('GET', '/api/works')).body.map((w: any) => w.title)).toEqual(['B의 작품']);
    expect((await a.json('GET', `/api/works/${bw.id}`)).status).toBe(404);
    const a2 = await createWork(a, 'A의 둘째');
    expect((await a.json('GET', `/api/works/${a2.id}/episodes/${f.e}`)).status).toBe(404);
    expect((await a.json('GET', `/api/works/${a2.id}/settings/${f.s}`)).status).toBe(404);
    expect((await a.json('GET', `/api/works/${a2.id}/resources/${f.r}`)).status).toBe(404);
  });
});
