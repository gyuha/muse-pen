import { FakeImageProvider, type ImageProvider } from '@muse-pen/image-engine';
import { FakeTextProvider, type TextRequest } from '@muse-pen/story-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { character, createHarness, createWork, makeClient, parseSse, para, type Harness } from './helpers';

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
});
function harness(options = {}, dir?: string): Harness {
  const h = createHarness(options, dir);
  cleanups.push(() => h.cleanup());
  return h;
}

// 호출이 끝나는 시점을 테스트가 쥘 수 있는 이미지 공급자(중간 상태를 관찰하기 위함)
function gatedImageProvider() {
  const inner = new FakeImageProvider();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let fail: string | null = null;
  let calls = 0;
  const provider: ImageProvider = {
    async generate(req) {
      calls += 1;
      await gate;
      if (fail) throw new Error(fail);
      return inner.generate(req);
    },
  };
  cleanups.push(() => release());
  return { provider, release, failWith: (m: string | null) => (fail = m), calls: () => calls };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withEpisode(options = {}) {
  const t = harness(options);
  const a = await t.signUp('a@x.com');
  const w = (await createWork(a)).id;
  const e = (await a.json('POST', `/api/works/${w}/episodes`, { title: '1화', bodyJson: [para('원문 본문')] })).body;
  return { t, a, w, e, base: `/api/works/${w}/episodes/${e.id}/ai` };
}

const WORDS = '첫째 문장입니다. 둘째 문장입니다. 셋째 문장입니다.';
const WORD_TOKENS = ['첫째 ', '문장입니다. ', '둘째 ', '문장입니다. ', '셋째 ', '문장입니다.'];

describe('[AC-12] SSE 스트리밍', () => {
  it('[AC-12] 이어쓰기 요청이 text/event-stream으로 가짜 공급자의 토큰을 순서대로 흘리고 suggestion → done으로 정상 종료된다', async () => {
    const provider = new FakeTextProvider(() => WORDS);
    const { a, base } = await withEpisode({ textProvider: provider });
    const res = await a.req('POST', `${base}/continue`, { textBefore: '그는 걸었다.' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const events = parseSse(await res.text());
    const tokens = events.filter((e) => e.event === 'token').map((e) => e.data.text);
    expect(tokens).toEqual(WORD_TOKENS); // 공급자가 낸 순서 그대로
    expect(events.map((e) => e.event)).toEqual([...tokens.map(() => 'token'), 'suggestion', 'done']);
    expect(events.find((e) => e.event === 'suggestion')!.data).toMatchObject({ task: 'continue', text: WORDS, warnings: [] });
    expect(provider.calls).toBe(1);
    expect(provider.requests[0]!.task).toBe('continue');
    expect(provider.requests[0]!.prompt).toContain('그는 걸었다.'); // 요청 본문이 공급자까지 전달됐다
  });

  it('[AC-12] 토큰은 하나씩 흘러나오고 합치면 제안 전체와 같다(순서 뒤섞임 없음)', async () => {
    const text = Array.from({ length: 40 }, (_, i) => `단어${i}`).join(' ');
    const { a, base } = await withEpisode({ textProvider: new FakeTextProvider(() => text) });
    const events = parseSse(await (await a.req('POST', `${base}/continue`, { textBefore: 'x' })).text());
    const tokens = events.filter((e) => e.event === 'token').map((e) => e.data.text as string);
    expect(tokens.length).toBe(40);
    expect(tokens.join('')).toBe(text);
    expect(events.find((e) => e.event === 'suggestion')!.data.text).toBe(text);
  });

  it('[AC-12] 스트리밍 요청은 본문을 바꾸지 않는다(AI 제안은 수락 전까지 반영되지 않는다)', async () => {
    const { a, w, e, base } = await withEpisode({ textProvider: new FakeTextProvider(() => WORDS) });
    await (await a.req('POST', `${base}/continue`, { textBefore: 'x' })).text();
    expect((await a.json('GET', `/api/works/${w}/episodes/${e.id}`)).body.bodyText).toBe('원문 본문');
  });

  it('[AC-12] 다시쓰기·문체 다듬기·늘리기·줄이기·초안도 같은 방식으로 흘려보내고 종류별 작업으로 공급자에 전달한다', async () => {
    const provider = new FakeTextProvider(() => '결과 하나 둘.');
    const { a, base } = await withEpisode({ textProvider: provider });
    for (const task of ['rewrite', 'polish', 'expand', 'shrink']) {
      const res = await a.req('POST', `${base}/${task}`, { selection: '선택한 문장' });
      expect(res.headers.get('content-type'), task).toContain('text/event-stream');
      const events = parseSse(await res.text());
      expect(events.at(-1)!.event, task).toBe('done');
      expect(events.find((e) => e.event === 'suggestion')!.data.task, task).toBe(task);
    }
    const draft = parseSse(await (await a.req('POST', `${base}/draft`, {})).text());
    expect(draft.at(-1)!.event).toBe('done');
    expect(provider.requests.map((r) => r.task)).toEqual(['rewrite', 'polish', 'expand', 'shrink', 'draft']);
    expect(provider.requests[0]!.prompt).toContain('선택한 문장');
  });

  it('[AC-12] 필요한 입력(textBefore·selection)이 없으면 400이고 공급자는 호출되지 않는다', async () => {
    const provider = new FakeTextProvider(() => 'x');
    const { a, base } = await withEpisode({ textProvider: provider });
    expect((await a.json('POST', `${base}/continue`, {})).status).toBe(400);
    expect((await a.json('POST', `${base}/rewrite`, {})).status).toBe(400);
    expect((await a.json('POST', `${base}/continue`, { textBefore: 'x', bogus: 1 })).status).toBe(400);
    expect(provider.calls).toBe(0);
  });

  it('[AC-12] 로그인하지 않으면 401이고 공급자는 호출되지 않는다', async () => {
    const provider = new FakeTextProvider(() => 'x');
    const { t, base } = await withEpisode({ textProvider: provider });
    expect((await t.client().json('POST', `${base}/continue`, { textBefore: 'x' })).status).toBe(401);
    expect(provider.calls).toBe(0);
  });

  it('[AC-12] 공급자가 실패하면 error 이벤트로 끝나고 suggestion·done은 오지 않는다', async () => {
    const { a, base } = await withEpisode({ textProvider: new FakeTextProvider(() => { throw new Error('공급자 폭발'); }) });
    const events = parseSse(await (await a.req('POST', `${base}/continue`, { textBefore: 'x' })).text());
    expect(events.at(-1)).toEqual({ event: 'error', data: { message: '공급자 폭발' } });
    expect(events.map((e) => e.event)).not.toContain('done');
    expect(events.map((e) => e.event)).not.toContain('suggestion');
  });

  it('[AC-12] 설정 점검·ghost text는 SSE가 아니라 JSON 응답이다(ghost는 한 문장 이내)', async () => {
    const provider = new FakeTextProvider((r: TextRequest) => (r.task === 'setting_check' ? JSON.stringify({ issues: [{ kind: 'contradiction', settingId: null, description: '모순' }] }) : '첫 문장이다. 둘째 문장이다.'));
    const { a, base } = await withEpisode({ textProvider: provider });
    const ghost = await a.json('POST', `${base}/ghost`, { textBefore: '그는' });
    expect(ghost.status).toBe(200);
    expect(ghost.body.text).toBe('첫 문장이다.');
    const check = await a.json('POST', `${base}/setting-check`, {});
    expect(check.status).toBe(200);
    expect(check.body.issues).toEqual([{ kind: 'contradiction', settingId: null, description: '모순' }]);
  });
});

describe('[AC-13] 긴 작업: 작업 테이블·워커', () => {
  async function imageSetup(options = {}) {
    const t = harness(options);
    const a = await t.signUp('a@x.com');
    const w = (await createWork(a)).id;
    const s = (await a.json('POST', `/api/works/${w}/settings`, character('하린'))).body;
    return { t, a, w, s };
  }

  it('[AC-13] 작업은 대기로 등록된 뒤 실행중을 거쳐 완료로 전이한다(작업 테이블에 기록)', async () => {
    const g = gatedImageProvider();
    const { t, a, w, s } = await imageSetup({ imageProvider: g.provider });
    const created = await a.json('POST', `/api/works/${w}/settings/${s.id}/images`, { quality: 'draft' });
    expect(created.status).toBe(202);
    expect(created.body).toMatchObject({ status: 'pending', kind: 'image_generation', workId: w, targetId: s.id });
    expect(t.api.services.repo.getJob(created.body.id)).toBeTruthy(); // 작업 테이블에 있다

    await sleep(50);
    expect((await a.json('GET', `/api/jobs/${created.body.id}`)).body.status).toBe('running');
    expect(t.api.services.repo.getJob(created.body.id)!.status).toBe('running');
    expect(((await a.json('GET', `/api/works/${w}/jobs`)).body as any[]).map((j) => j.id)).toContain(created.body.id);

    g.release();
    await t.api.whenJobsIdle();
    const done = (await a.json('GET', `/api/jobs/${created.body.id}`)).body;
    expect(done).toMatchObject({ status: 'completed', error: null });
    expect(done.result.imageId).toBeTruthy();
    expect(g.calls()).toBe(1);
  });

  it('[AC-13] 작업은 등록한 순서대로 하나씩 처리된다(동시에 두 개가 실행중이 되지 않는다)', async () => {
    const g = gatedImageProvider();
    const { t, a, w, s } = await imageSetup({ imageProvider: g.provider });
    const j1 = (await a.json('POST', `/api/works/${w}/settings/${s.id}/images`, {})).body;
    const j2 = (await a.json('POST', `/api/works/${w}/settings/${s.id}/images`, {})).body;
    await sleep(50);
    const statuses = [j1, j2].map((j) => t.api.services.repo.getJob(j.id)!.status);
    expect(statuses).toEqual(['running', 'pending']); // 먼저 등록한 작업이 먼저, 하나만 실행중
    g.release();
    await t.api.whenJobsIdle();
    expect([j1, j2].map((j) => t.api.services.repo.getJob(j.id)!.status)).toEqual(['completed', 'completed']);
  });

  it('[AC-13] 공급자 오류는 실패로 기록되고 오류 메시지가 남는다. 이미지 기록은 만들어지지 않는다', async () => {
    const g = gatedImageProvider();
    g.failWith('공급자 오류: 콘텐츠 정책 차단');
    g.release();
    const { t, a, w, s } = await imageSetup({ imageProvider: g.provider });
    const job = (await a.json('POST', `/api/works/${w}/settings/${s.id}/images`, {})).body;
    await t.api.whenJobsIdle();
    const failed = (await a.json('GET', `/api/jobs/${job.id}`)).body;
    expect(failed).toMatchObject({ status: 'failed', error: '공급자 오류: 콘텐츠 정책 차단' });
    expect((await a.json('GET', `/api/works/${w}/settings/${s.id}/images`)).body).toEqual([]);
    expect(t.api.services.repo.listImages(w, { targetType: 'setting', targetId: s.id })).toEqual([]);
  });

  it('[AC-13] 실패한 작업은 재요청할 수 있고 재요청하면 완료된다. 실패가 아닌 작업은 재요청할 수 없다', async () => {
    const g = gatedImageProvider();
    g.failWith('일시 오류');
    const { t, a, w, s } = await imageSetup({ imageProvider: g.provider });
    const job = (await a.json('POST', `/api/works/${w}/settings/${s.id}/images`, {})).body;
    expect((await a.json('POST', `/api/jobs/${job.id}/retry`)).status).toBe(409); // 아직 실패가 아님
    g.release();
    await t.api.whenJobsIdle();
    expect((await a.json('GET', `/api/jobs/${job.id}`)).body.status).toBe('failed');

    g.failWith(null);
    const retried = await a.json('POST', `/api/jobs/${job.id}/retry`);
    expect(retried.status).toBe(200);
    expect(retried.body.status).not.toBe('failed');
    await t.api.whenJobsIdle();
    const done = (await a.json('GET', `/api/jobs/${job.id}`)).body;
    expect(done).toMatchObject({ status: 'completed', error: null });
    expect(t.api.services.repo.listImages(w, { targetType: 'setting', targetId: s.id })).toHaveLength(1);
    expect((await a.json('POST', `/api/jobs/${job.id}/retry`)).status).toBe(409); // 완료 후엔 재요청 불가
  });

  it('[AC-13] 회차 완료 처리도 작업으로 등록되어 완료되고, 공급자 오류면 실패로 기록되며 재요청할 수 있다', async () => {
    let failing = true;
    const provider = new FakeTextProvider(() => {
      if (failing) throw new Error('텍스트 공급자 오류');
      return JSON.stringify({ summary: '1화 요약', fieldChanges: [] });
    });
    const { t, a, w, e } = await withEpisode({ textProvider: provider });
    const job = await a.json('POST', `/api/works/${w}/episodes/${e.id}/complete`);
    expect(job.status).toBe(202);
    expect(job.body).toMatchObject({ kind: 'episode_completion', targetId: e.id });
    await t.api.whenJobsIdle();
    expect((await a.json('GET', `/api/jobs/${job.body.id}`)).body).toMatchObject({ status: 'failed', error: '텍스트 공급자 오류' });

    failing = false;
    expect((await a.json('POST', `/api/jobs/${job.body.id}/retry`)).status).toBe(200);
    await t.api.whenJobsIdle();
    expect((await a.json('GET', `/api/jobs/${job.body.id}`)).body).toMatchObject({ status: 'completed', result: { summary: '1화 요약' } });
    expect((await a.json('GET', `/api/works/${w}/episodes/${e.id}/summary`)).body).toEqual({ content: '1화 요약', aiGenerated: true });
  });

  it('[AC-13] api를 재시작해도(같은 DB 파일로 앱을 다시 만들어도) 완료·실패 작업 기록이 그대로 남는다', async () => {
    const t1 = harness();
    const a1 = await t1.signUp('a@x.com');
    const w = (await createWork(a1)).id;
    const s = (await a1.json('POST', `/api/works/${w}/settings`, character('하린'))).body;
    const ok = (await a1.json('POST', `/api/works/${w}/settings/${s.id}/images`, {})).body;
    await t1.api.whenJobsIdle();
    const before = (await a1.json('GET', `/api/jobs/${ok.id}`)).body;
    expect(before.status).toBe('completed');

    // 1차 재시작: 텍스트 공급자가 실패하도록 해 실패 작업을 하나 만든다
    await t1.api.close();
    const failing = new FakeTextProvider(() => { throw new Error('재시작 전 실패'); });
    const t2 = harness({ textProvider: failing }, t1.dir);
    const a2 = makeClient(t2.api, a1.cookie); // 같은 DB·같은 비밀 키라 세션 쿠키도 유효하다
    const e = (await a2.json('POST', `/api/works/${w}/episodes`, { title: '1화' })).body;
    const bad = (await a2.json('POST', `/api/works/${w}/episodes/${e.id}/complete`)).body;
    await t2.api.whenJobsIdle();
    const failedBefore = (await a2.json('GET', `/api/jobs/${bad.id}`)).body;
    expect(failedBefore).toMatchObject({ status: 'failed', error: '재시작 전 실패' });

    // 2차 재시작: 두 기록이 그대로이고, 실패한 작업은 여전히 재요청할 수 있다
    await t2.api.close();
    const t3 = harness({}, t1.dir);
    const a3 = makeClient(t3.api, a1.cookie);
    expect((await a3.json('GET', `/api/jobs/${ok.id}`)).body).toEqual(before);
    expect((await a3.json('GET', `/api/jobs/${bad.id}`)).body).toEqual(failedBefore);
    expect(((await a3.json('GET', `/api/works/${w}/jobs`)).body as any[]).map((j) => j.id).sort()).toEqual([ok.id, bad.id].sort());
    expect((await a3.json('POST', `/api/jobs/${bad.id}/retry`)).status).toBe(200);
    await t3.api.whenJobsIdle();
    expect((await a3.json('GET', `/api/jobs/${bad.id}`)).body.status).toBe('completed');
  });

  it('[AC-13] 재시작 때 실행중으로 남은 작업(프로세스가 죽은 흔적)은 대기로 되돌아가 새 워커가 이어서 완료한다', async () => {
    const g = gatedImageProvider(); // 풀지 않아 첫 앱에서는 실행중에 멈춰 있다
    const t1 = harness({ imageProvider: g.provider });
    const a1 = await t1.signUp('a@x.com');
    const w = (await createWork(a1)).id;
    const s = (await a1.json('POST', `/api/works/${w}/settings`, character('하린'))).body;
    const job = (await a1.json('POST', `/api/works/${w}/settings/${s.id}/images`, {})).body;
    await sleep(50);
    expect(t1.api.services.repo.getJob(job.id)!.status).toBe('running');

    // 같은 DB 파일로 두 번째 앱(재시작). 첫 앱은 죽은 것으로 본다.
    const t2 = harness({}, t1.dir);
    const a2 = makeClient(t2.api, a1.cookie);
    await t2.api.whenJobsIdle();
    expect((await a2.json('GET', `/api/jobs/${job.id}`)).body).toMatchObject({ status: 'completed', error: null });
    g.release();
  });
});
