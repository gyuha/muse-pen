import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { character, concept, createTestApi, createWork, type Client, type TestApi } from './test-utils';

let t: TestApi;
let a: Client;
beforeEach(async () => { t = createTestApi(); a = (await t.signUp('a@x.com')).client; });
afterEach(() => t.cleanup());

describe('[AC-04] 작품·컨셉', () => {
  it('작품을 만들고 조회하고 고치고 지운다. 컨셉 5항목이 저장된다', async () => {
    const created = await a.json('POST', '/api/works', { title: '용의 길', concept });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect((await a.json('GET', `/api/works/${id}`)).body.concept).toEqual(concept);
    expect((await a.json('GET', '/api/works')).body.map((w: any) => w.id)).toEqual([id]);

    const next = { ...concept, genre: '판타지', pointOfView: 'first_person' };
    const patched = await a.json('PATCH', `/api/works/${id}`, { title: '새 제목', concept: next });
    expect(patched.body).toMatchObject({ title: '새 제목', concept: next });

    expect((await a.json('DELETE', `/api/works/${id}`)).status).toBe(204);
    expect((await a.json('GET', `/api/works/${id}`)).status).toBe(404);
  });

  it('잘못된 컨셉(정의되지 않은 필드·시점)은 거부한다', async () => {
    expect((await a.json('POST', '/api/works', { title: 't', concept: { ...concept, pointOfView: 'second' } })).status).toBe(400);
    expect((await a.json('POST', '/api/works', { title: 't', concept: { ...concept, extra: 1 } })).status).toBe(400);
  });

  it('작품 생성 시 존재하지 않는 화풍 레퍼런스 ID는 거부한다(0장은 허용)', async () => {
    const bad = { ...concept, artStylePreset: { prompt: 'x', referenceImageIds: ['nope'] } };
    expect((await a.json('POST', '/api/works', { title: 't', concept: bad })).status).toBe(422);
  });

  it('시놉시스는 작품마다 하나이고 고칠 수 있다', async () => {
    const w = await createWork(a);
    expect((await a.json('GET', `/api/works/${w.id}/synopsis`)).body.content).toBe('');
    await a.json('PUT', `/api/works/${w.id}/synopsis`, { content: '복수극' });
    expect((await a.json('PUT', `/api/works/${w.id}/synopsis`, { content: '복수극 2' })).body.content).toBe('복수극 2');
  });
});

describe('[AC-05] 회차', () => {
  it('순서를 유지하고, 블록 JSON 저장 시 파생 텍스트·Markdown을 함께 저장한다', async () => {
    const w = await createWork(a);
    const e1 = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '1화' })).body;
    const e2 = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '2화' })).body;
    const e3 = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '3화', order: 1 })).body;
    const order = async () => (await a.json('GET', `/api/works/${w.id}/episodes`)).body.map((e: any) => [e.title, e.order]);
    expect(await order()).toEqual([['3화', 1], ['1화', 2], ['2화', 3]]);

    await a.json('PATCH', `/api/works/${w.id}/episodes/${e2.id}`, { order: 1 });
    expect(await order()).toEqual([['2화', 1], ['3화', 2], ['1화', 3]]);
    await a.json('DELETE', `/api/works/${w.id}/episodes/${e3.id}`);
    expect(await order()).toEqual([['2화', 1], ['1화', 2]]);

    const blocks = [
      { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: '제목' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '첫 ' }, { type: 'text', text: '문장' }] },
    ];
    const saved = await a.json('PATCH', `/api/works/${w.id}/episodes/${e1.id}`, { bodyJson: blocks });
    expect(saved.body.bodyJson).toEqual(blocks);
    expect(saved.body.bodyText).toBe('제목\n첫 문장');
    expect(saved.body.bodyMarkdown).toBe('## 제목\n\n첫 문장');
    expect((await a.json('GET', `/api/works/${w.id}/episodes/${e1.id}`)).body.bodyText).toBe('제목\n첫 문장');
  });

  it('플롯 메모는 회차마다 하나, 고정 설정은 같은 작품의 설정만 가능하다', async () => {
    const w = await createWork(a);
    const w2 = await createWork(a, '다른 작품');
    const e = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '1화' })).body;
    const base = `/api/works/${w.id}/episodes/${e.id}`;
    await a.json('PUT', `${base}/plot-memo`, { content: '검을 줍는다' });
    expect((await a.json('PUT', `${base}/plot-memo`, { content: '검을 잃는다' })).body.content).toBe('검을 잃는다');

    const s = (await a.json('POST', `/api/works/${w.id}/settings`, character('하린'))).body;
    const other = (await a.json('POST', `/api/works/${w2.id}/settings`, character('타인'))).body;
    expect((await a.json('PUT', `${base}/pinned-settings`, { ids: [s.id] })).body.ids).toEqual([s.id]);
    expect((await a.json('PUT', `${base}/pinned-settings`, { ids: [other.id] })).status).toBe(422);
    expect((await a.json('GET', `${base}/pinned-settings`)).body.ids).toEqual([s.id]);
    await a.json('DELETE', `/api/works/${w.id}/settings/${s.id}`);
    expect((await a.json('GET', `${base}/pinned-settings`)).body.ids).toEqual([]);
  });
});

describe('[AC-06] 회차 스냅샷', () => {
  it('만들고 목록을 보고, 복원하면 본문이 그 시점과 같아진다', async () => {
    const w = await createWork(a);
    const e = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '1화', bodyJson: [{ type: 'paragraph', content: [{ type: 'text', text: '처음' }] }] })).body;
    const base = `/api/works/${w.id}/episodes/${e.id}`;
    const snap = (await a.json('POST', `${base}/snapshots`)).body;
    expect(snap.bodyText).toBe('처음');
    await a.json('PATCH', base, { bodyJson: [{ type: 'paragraph', content: [{ type: 'text', text: '바뀜' }] }] });
    await a.json('POST', `${base}/snapshots`);
    expect((await a.json('GET', `${base}/snapshots`)).body).toHaveLength(2);

    const restored = await a.json('POST', `${base}/snapshots/${snap.id}/restore`);
    expect(restored.body.bodyText).toBe('처음');
    expect(restored.body.bodyJson).toEqual(e.bodyJson);
    expect((await a.json('GET', base)).body.bodyMarkdown).toBe('처음');
    expect((await a.json('POST', `${base}/snapshots/nope/restore`)).status).toBe(404);
  });
});

describe('[AC-09] 자료', () => {
  const source = { url: 'https://example.com/a', title: '문서', quote: '가'.repeat(150), retrievedAt: '2026-11-02T00:00:00.000Z' };

  it('CRUD가 되고 150자 초과 인용·웹 원문 필드는 거부한다', async () => {
    const w = await createWork(a);
    const base = `/api/works/${w.id}/resources`;
    const created = await a.json('POST', base, { title: '검술', question: '무엇?', summary: '요약', sources: [source], tags: ['무협'] });
    expect(created.status).toBe(201);
    expect(created.body.sources[0].quote).toHaveLength(150);

    expect((await a.json('POST', base, { title: 'x', sources: [{ ...source, quote: '가'.repeat(151) }] })).status).toBe(400);
    expect((await a.json('POST', base, { title: 'x', content: '웹 원문' })).status).toBe(400);
    expect((await a.json('POST', base, { title: 'x', sources: [{ ...source, rawHtml: '<p/>' }] })).status).toBe(400);
    expect((await a.json('PATCH', `${base}/${created.body.id}`, { sources: [{ ...source, quote: '나'.repeat(151) }] })).status).toBe(400);

    const patched = await a.json('PATCH', `${base}/${created.body.id}`, { summary: '고친 요약' });
    expect(patched.body).toMatchObject({ summary: '고친 요약', title: '검술', tags: ['무협'] });
    expect((await a.json('GET', base)).body).toHaveLength(1);
    expect((await a.json('DELETE', `${base}/${created.body.id}`)).status).toBe(204);
    expect((await a.json('GET', base)).body).toHaveLength(0);
  });

  it('자료 조사 결과는 미검증 초안이고 web_search 사용 기록이 1건 남는다', async () => {
    const w = await createWork(a);
    const res = await a.json('POST', `/api/works/${w.id}/research`, { question: '조선 검술?' });
    expect(res.body.unverified).toBe(true);
    const usage = (await a.json('GET', '/api/usage')).body;
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ feature: 'web_search', usage: { unit: 'searches', count: 1 } });
  });
});

it('사이드 패널 대화는 저장만 한다', async () => {
  const w = await createWork(a);
  await a.json('POST', `/api/works/${w.id}/side-chat`, { role: 'user', content: '줄거리 구상' });
  expect((await a.json('GET', `/api/works/${w.id}/side-chat`)).body).toHaveLength(1);
});
