import { FakeTextProvider } from '@muse-pen/story-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { character, createTestApi, createWork, parseSse, type TestApi } from './test-utils';

let t: TestApi;
afterEach(() => t?.cleanup());

async function setup(provider = new FakeTextProvider(() => '첫째 문장. 둘째 문장.')) {
  t = createTestApi({ textProvider: provider });
  const a = (await t.signUp('a@x.com')).client;
  const w = await createWork(a);
  const e = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '1화', bodyJson: [{ type: 'paragraph', content: [{ type: 'text', text: '원문' }] }] })).body;
  return { a, w, e, base: `/api/works/${w.id}/episodes/${e.id}` };
}

describe('[AC-12] SSE 스트리밍', () => {
  it('가짜 공급자의 토큰을 순서대로 흘리고 AI 제안과 종료 이벤트로 끝난다. 본문은 그대로다', async () => {
    const { a, base } = await setup();
    const res = await a.req('POST', `${base}/ai/continue`, { textBefore: '그는 걸었다.' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const events = parseSse(await res.text());

    const tokens = events.filter((e) => e.event === 'token').map((e) => e.data.text);
    expect(tokens).toEqual(['첫째 ', '문장. ', '둘째 ', '문장.']);
    expect(events.map((e) => e.event)).toEqual(['token', 'token', 'token', 'token', 'suggestion', 'done']);
    const suggestion = events.find((e) => e.event === 'suggestion')!.data;
    expect(suggestion).toMatchObject({ task: 'continue', text: tokens.join(''), warnings: [] });

    expect((await a.json('GET', base)).body.bodyText).toBe('원문'); // AI 제안은 수락 전까지 본문에 반영되지 않는다
  });

  it('요청 종류별 입력을 검사하고, 종류마다 엔진 작업으로 연결된다', async () => {
    const provider = new FakeTextProvider(() => '결과');
    const { a, base } = await setup(provider);
    expect((await a.json('POST', `${base}/ai/continue`, {})).status).toBe(400);
    expect((await a.json('POST', `${base}/ai/rewrite`, {})).status).toBe(400);
    expect(provider.calls).toBe(0);
    for (const task of ['rewrite', 'polish', 'expand', 'shrink']) {
      const events = parseSse(await (await a.req('POST', `${base}/ai/${task}`, { selection: '문장' })).text());
      expect(events.at(-1)!.event).toBe('done');
    }
    expect(parseSse(await (await a.req('POST', `${base}/ai/draft`, {})).text()).at(-2)!.data.task).toBe('draft');
    expect(provider.requests.map((r) => r.task)).toEqual(['rewrite', 'polish', 'expand', 'shrink', 'draft']);
  });

  it('사망·행방불명 캐릭터가 제안에 나오면 경고가 붙는다', async () => {
    const { a, w, base } = await setup(new FakeTextProvider(() => '하린이 웃었다.'));
    await a.json('POST', `/api/works/${w.id}/settings`, character('하린', { status: 'dead' }));
    const events = parseSse(await (await a.req('POST', `${base}/ai/continue`, { textBefore: 'x' })).text());
    const warnings = events.find((e) => e.event === 'suggestion')!.data.warnings;
    expect(warnings).toMatchObject([{ name: '하린', status: 'dead' }]);
  });

  it('공급자가 실패하면 error 이벤트로 끝난다', async () => {
    const { a, base } = await setup(new FakeTextProvider(() => { throw new Error('boom'); }));
    const events = parseSse(await (await a.req('POST', `${base}/ai/continue`, { textBefore: 'x' })).text());
    expect(events.at(-1)).toEqual({ event: 'error', data: { message: 'boom' } });
    expect((await a.json('GET', '/api/usage')).body).toEqual([]);
  });
});

describe('[AC-15] AI 사용 기록', () => {
  it('공급자 호출 1회마다 기록 1건이 남는다(작가·기능·모델·사용량·추정 비용)', async () => {
    const provider = new FakeTextProvider(() => '첫째 문장. 둘째 문장.');
    const { a, base } = await setup(provider);
    await (await a.req('POST', `${base}/ai/continue`, { textBefore: 'x' })).text();
    let usage = (await a.json('GET', '/api/usage')).body;
    expect(provider.calls).toBe(1);
    expect(usage).toHaveLength(1);
    const me = (await a.json('GET', '/api/me')).body;
    expect(usage[0]).toMatchObject({ authorId: me.id, feature: 'text_generation', modelId: 'claude-sonnet-5-5', usage: { unit: 'tokens' }, estimatedCostUsd: 0 });
    expect(usage[0].usage.inputTokens).toBeGreaterThan(0);

    const ghost = await a.json('POST', `${base}/ai/ghost`, { textBefore: '그는' });
    expect(ghost.body.text).toBe('첫째 문장.');
    usage = (await a.json('GET', '/api/usage')).body;
    expect(provider.calls).toBe(2);
    expect(usage.map((u: any) => [u.feature, u.modelId])).toEqual([['text_generation', 'claude-sonnet-5-5'], ['ghost_text', 'claude-haiku-5-5']]);
  });

  it('단가표가 있으면 추정 비용을 계산한다', async () => {
    t = createTestApi({ pricing: { 'claude-sonnet-5-5': { inputPerMillionTokens: 1_000_000, outputPerMillionTokens: 2_000_000 } } });
    const a = (await t.signUp('a@x.com')).client;
    const w = await createWork(a);
    const e = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '1' })).body;
    await (await a.req('POST', `/api/works/${w.id}/episodes/${e.id}/ai/continue`, { textBefore: 'x' })).text();
    const u = (await a.json('GET', '/api/usage')).body[0];
    expect(u.estimatedCostUsd).toBeCloseTo(u.usage.inputTokens + 2 * u.usage.outputTokens);
  });

  it('관리자는 전체 사용 기록을 본다', async () => {
    const { a, base } = await setup();
    await (await a.req('POST', `${base}/ai/continue`, { textBefore: 'x' })).text();
    const admin = await t.admin();
    expect((await admin.json('GET', '/api/admin/usage')).body).toHaveLength(1);
    expect((await a.json('GET', '/api/admin/usage')).status).toBe(403);
  });
});
