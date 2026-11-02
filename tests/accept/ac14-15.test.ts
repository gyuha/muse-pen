import { FakeImageProvider, type ImageProvider } from '@muse-pen/image-engine';
import { FakeSearchProvider, FakeTextProvider } from '@muse-pen/story-engine';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { character, createHarness, createWork, para, world, type Client, type Harness } from './helpers';

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
});
function harness(options = {}): Harness {
  const h = createHarness(options);
  cleanups.push(() => h.cleanup());
  return h;
}

const PNG = [137, 80, 78, 71, 13, 10, 26, 10];

describe('[AC-14] 이미지 생성', () => {
  async function setup(options = {}) {
    const t = harness(options);
    const a = await t.signUp('a@x.com');
    const w = (await createWork(a)).id;
    const s = (await a.json('POST', `/api/works/${w}/settings`, character('하린'))).body;
    return { t, a, w, s };
  }
  const gen = async (a: Client, t: Harness, w: string, sid: string, quality?: string) => {
    const job = (await a.json('POST', `/api/works/${w}/settings/${sid}/images`, quality ? { quality } : {})).body;
    await t.api.whenJobsIdle();
    return (await a.json('GET', `/api/jobs/${job.id}`)).body;
  };

  it('[AC-14] 가짜 이미지 공급자로 생성하면 파일이 로컬 디스크 저장소에 저장되고 이미지 기록에 모델 ID가 남는다', async () => {
    const { t, a, w, s } = await setup();
    const job = await gen(a, t, w, s.id, 'draft');
    expect(job.status).toBe('completed');
    const imageId = job.result.imageId as string;
    const record = t.api.services.repo.getImage(imageId)!;
    expect(record).toMatchObject({ id: imageId, workId: w, targetType: 'setting', targetId: s.id });
    expect(record.modelId).toBeTruthy();
    expect(record.modelId).toBe(job.result.modelId);
    expect(record.storageKey).toContain(w);

    const file = join(t.imageDir, record.storageKey);
    expect(existsSync(file)).toBe(true);
    expect([...readFileSync(file).subarray(0, 8)]).toEqual(PNG);
    // 저장소 인터페이스로도 읽힌다
    const stored = await t.api.services.storage.read(record.storageKey);
    expect(stored.contentType).toBe('image/png');
    expect(Buffer.from(stored.data).equals(readFileSync(file))).toBe(true);
  });

  it('[AC-14] 이미지 조회 응답과 설정의 이미지 목록에 모델 ID와 접근 URL이 있고, 그 URL로 같은 파일을 받는다', async () => {
    const { t, a, w, s } = await setup();
    const job = await gen(a, t, w, s.id);
    const imageId = job.result.imageId as string;
    const meta = await a.json('GET', `/api/images/${imageId}`);
    expect(meta.status).toBe(200);
    expect(meta.body.modelId).toBeTruthy();
    expect(meta.body.url).toBeTruthy();
    const list = (await a.json('GET', `/api/works/${w}/settings/${s.id}/images`)).body as any[];
    expect(list.map((i) => [i.id, i.modelId])).toEqual([[imageId, meta.body.modelId]]);
    const res = await a.req('GET', meta.body.url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.equals(readFileSync(join(t.imageDir, t.api.services.repo.getImage(imageId)!.storageKey)))).toBe(true);
  });

  it('[AC-14] 초안과 최종은 서로 다른 모델 ID로 기록되고 각각 파일이 저장된다', async () => {
    const { t, a, w, s } = await setup();
    const d = await gen(a, t, w, s.id, 'draft');
    const f = await gen(a, t, w, s.id, 'final');
    const dr = t.api.services.repo.getImage(d.result.imageId)!;
    const fr = t.api.services.repo.getImage(f.result.imageId)!;
    expect(dr.modelId).toBeTruthy();
    expect(fr.modelId).toBeTruthy();
    expect(dr.modelId).not.toBe(fr.modelId);
    expect(dr.storageKey).not.toBe(fr.storageKey);
    expect(existsSync(join(t.imageDir, dr.storageKey))).toBe(true);
    expect(existsSync(join(t.imageDir, fr.storageKey))).toBe(true);
  });

  it('[AC-14] 다른 작가는 그 이미지를 받을 수 없다(기록·파일 모두 404), 비로그인은 401', async () => {
    const { t, a, w, s } = await setup();
    const job = await gen(a, t, w, s.id);
    const imageId = job.result.imageId as string;
    const key = t.api.services.repo.getImage(imageId)!.storageKey;
    const b = await t.signUp('b@x.com');
    expect((await b.json('GET', `/api/images/${imageId}`)).status).toBe(404);
    const stolen = await b.req('GET', `/api/image-files/${key}`);
    expect(stolen.status).toBe(404);
    expect(new Uint8Array(await stolen.arrayBuffer()).slice(0, 4)).not.toEqual(new Uint8Array(PNG.slice(0, 4)));
    expect((await t.client().req('GET', `/api/image-files/${key}`)).status).toBe(401);
    // 정적 경로로도 공개되지 않는다
    expect((await t.client().req('GET', `/${key}`)).status).toBe(404);
    expect((await a.req('GET', `/api/image-files/${key}`)).status).toBe(200); // 소유자는 계속 받는다
  });

  it('[AC-14] 경로 조작 키(..)로는 저장소 밖 파일을 받을 수 없다', async () => {
    const { a } = await setup();
    for (const p of ['/api/image-files/../../etc/passwd', '/api/image-files/..%2F..%2Fetc%2Fpasswd', '/api/image-files/%2e%2e/%2e%2e/x']) {
      const r = await a.req('GET', p);
      expect([400, 404], p).toContain(r.status);
    }
  });

  it('[AC-14] 세계관은 이미지를 만들지 않는다(422, 작업이 등록되지 않음)', async () => {
    const { t, a, w } = await setup();
    const wd = (await a.json('POST', `/api/works/${w}/settings`, world('강호'))).body;
    const r = await a.json('POST', `/api/works/${w}/settings/${wd.id}/images`, {});
    expect(r.status).toBe(422);
    expect(t.api.services.repo.listJobs(w)).toEqual([]);
  });

  it('[AC-14] 이미지를 지우면 기록과 저장소 파일이 함께 사라진다', async () => {
    const { t, a, w, s } = await setup();
    const job = await gen(a, t, w, s.id);
    const imageId = job.result.imageId as string;
    const key = t.api.services.repo.getImage(imageId)!.storageKey;
    expect(existsSync(join(t.imageDir, key))).toBe(true);
    expect((await a.req('DELETE', `/api/images/${imageId}`)).status).toBe(204);
    expect(t.api.services.repo.getImage(imageId)).toBeFalsy();
    expect(existsSync(join(t.imageDir, key))).toBe(false);
  });
});

async function withEpisode(options = {}) {
  const t = harness(options);
  const a = await t.signUp('a@x.com');
  const w = (await createWork(a)).id;
  const e = (await a.json('POST', `/api/works/${w}/episodes`, { title: '1화', bodyJson: [para('원문 본문')] })).body;
  return { t, a, w, e, base: `/api/works/${w}/episodes/${e.id}/ai` };
}

const WORDS = '첫째 문장입니다. 둘째 문장입니다. 셋째 문장입니다.';

describe('[AC-15] AI 사용 기록', () => {
  it('[AC-15] 텍스트 공급자 호출 1회마다 사용 기록 1건이 남고 작가·기능·모델·사용량·추정 비용이 채워진다', async () => {
    const provider = new FakeTextProvider(() => WORDS);
    const { t, a, base } = await withEpisode({ textProvider: provider, pricing: { 'claude-sonnet-5-5': { inputPerMillionTokens: 3, outputPerMillionTokens: 15 } } });
    expect((await a.json('GET', '/api/usage')).body).toEqual([]);
    await (await a.req('POST', `${base}/continue`, { textBefore: '시작' })).text();

    expect(provider.calls).toBe(1);
    const usage = (await a.json('GET', '/api/usage')).body as any[];
    expect(usage).toHaveLength(1);
    const me = (await a.json('GET', '/api/me')).body;
    const req = provider.requests[0]!;
    const inTok = Math.ceil((req.system + req.prompt).length / 2);
    const outTok = Math.ceil(WORDS.length / 2);
    expect(usage[0]).toMatchObject({
      authorId: me.id, feature: 'text_generation', modelId: req.model,
      usage: { unit: 'tokens', inputTokens: inTok, outputTokens: outTok },
    });
    expect(usage[0].estimatedCostUsd).toBeCloseTo((inTok * 3 + outTok * 15) / 1_000_000, 10);
    expect(usage[0].estimatedCostUsd).toBeGreaterThan(0);
    expect(t.api.services.repo.listUsage(me.id)).toHaveLength(1); // DB에도 1건
  });

  it('[AC-15] 단가표에 없는 모델(가짜 공급자)은 추정 비용 0으로 기록된다', async () => {
    const { a, base } = await withEpisode({ textProvider: new FakeTextProvider(() => WORDS) });
    await (await a.req('POST', `${base}/continue`, { textBefore: 'x' })).text();
    expect(((await a.json('GET', '/api/usage')).body as any[])[0].estimatedCostUsd).toBe(0);
  });

  it('[AC-15] 기능별로 기능 이름이 맞다: ghost(하위 모델)·설정 점검·회차 완료·이미지·자료 검색, 호출 수 = 기록 수', async () => {
    const text = new FakeTextProvider((r) => (r.task === 'episode_completion' ? JSON.stringify({ summary: '요약', fieldChanges: [] }) : r.task === 'setting_check' ? JSON.stringify({ issues: [] }) : '문장이다. 또 문장.'));
    const search = new FakeSearchProvider();
    const image = new FakeImageProvider();
    let imageCalls = 0;
    const countingImage: ImageProvider = { generate: (r) => { imageCalls += 1; return image.generate(r); } };
    const { t, a, w, e, base } = await withEpisode({ textProvider: text, searchProvider: search, imageProvider: countingImage });
    const s = (await a.json('POST', `/api/works/${w}/settings`, character('하린'))).body;

    await a.json('POST', `${base}/ghost`, { textBefore: '그는' });
    await a.json('POST', `${base}/setting-check`, {});
    await (await a.req('POST', `${base}/rewrite`, { selection: '문장' })).text();
    await a.json('POST', `/api/works/${w}/research`, { question: '조선 복식은?' });
    await a.json('POST', `/api/works/${w}/episodes/${e.id}/complete`);
    await a.json('POST', `/api/works/${w}/settings/${s.id}/images`, { quality: 'draft' });
    await t.api.whenJobsIdle();

    expect(text.calls).toBe(4); // ghost, setting-check, rewrite, completion
    expect(search.calls).toBe(1);
    expect(imageCalls).toBe(1);
    const usage = (await a.json('GET', '/api/usage')).body as any[];
    expect(usage).toHaveLength(text.calls + search.calls + imageCalls); // 호출 1회 = 기록 1건
    expect(usage.map((u) => u.feature).sort()).toEqual(['episode_completion', 'ghost_text', 'image_generation', 'setting_check', 'text_generation', 'web_search']);

    const by = (f: string) => usage.find((u) => u.feature === f);
    expect(by('ghost_text').usage.unit).toBe('tokens');
    expect(by('ghost_text').modelId).toBe(text.requests.find((r) => r.task === 'ghost')!.model);
    expect(by('ghost_text').modelId).not.toBe(by('text_generation').modelId); // ghost는 하위 모델
    expect(by('image_generation')).toMatchObject({ usage: { unit: 'images', count: 1 } });
    expect(by('image_generation').modelId).toBeTruthy();
    expect(by('web_search')).toMatchObject({ usage: { unit: 'searches', count: 1 }, modelId: 'fake-search' });
    const me = (await a.json('GET', '/api/me')).body;
    for (const u of usage) expect(u.authorId).toBe(me.id);
  });

  it('[AC-15] 호출을 여러 번 하면 그만큼 기록이 쌓이고 각 기록에 고유 ID와 시각이 있다', async () => {
    const provider = new FakeTextProvider(() => WORDS);
    const { a, base } = await withEpisode({ textProvider: provider });
    for (let i = 0; i < 3; i++) await (await a.req('POST', `${base}/continue`, { textBefore: `x${i}` })).text();
    const usage = (await a.json('GET', '/api/usage')).body as any[];
    expect(provider.calls).toBe(3);
    expect(usage).toHaveLength(3);
    expect(new Set(usage.map((u) => u.id)).size).toBe(3);
    for (const u of usage) expect(Number.isNaN(Date.parse(u.createdAt))).toBe(false);
  });

  it('[AC-15] 검증 실패로 공급자를 호출하지 않은 요청은 기록을 남기지 않는다', async () => {
    const provider = new FakeTextProvider(() => WORDS);
    const { a, base } = await withEpisode({ textProvider: provider });
    await a.json('POST', `${base}/continue`, {});
    expect(provider.calls).toBe(0);
    expect((await a.json('GET', '/api/usage')).body).toEqual([]);
  });

  it('[AC-15] 작가는 자기 기록만 보고, 관리자는 모든 작가의 기록을 본다. 일반 작가는 관리자 조회가 막힌다', async () => {
    const provider = new FakeTextProvider(() => WORDS);
    const t = harness({ textProvider: provider });
    const a = await t.signUp('a@x.com');
    const b = await t.signUp('b@x.com');
    const mk = async (c: Client) => {
      const w = (await createWork(c)).id;
      const e = (await c.json('POST', `/api/works/${w}/episodes`, { title: '1화' })).body;
      await (await c.req('POST', `/api/works/${w}/episodes/${e.id}/ai/continue`, { textBefore: 'x' })).text();
    };
    await mk(a);
    await mk(a);
    await mk(b);
    const ua = (await a.json('GET', '/api/usage')).body as any[];
    const ub = (await b.json('GET', '/api/usage')).body as any[];
    expect([ua.length, ub.length]).toEqual([2, 1]);
    const aId = (await a.json('GET', '/api/me')).body.id;
    expect(ua.every((u) => u.authorId === aId)).toBe(true);

    expect((await b.json('GET', '/api/admin/usage')).status).toBe(403);
    const admin = await t.admin();
    expect((await admin.json('GET', '/api/admin/usage')).body).toHaveLength(3);
    expect((await admin.json('GET', `/api/admin/usage?authorId=${aId}`)).body).toHaveLength(2);
  });
});
