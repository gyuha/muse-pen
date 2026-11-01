import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { character, createTestApi, createWork, type Client, type TestApi } from './test-utils';

let t: TestApi;
let a: Client;
let b: Client;
beforeEach(async () => {
  t = createTestApi();
  a = (await t.signUp('a@x.com')).client;
  b = (await t.signUp('b@x.com')).client;
});
afterEach(() => t.cleanup());

describe('[AC-03] 작가별 소유권', () => {
  it('작가 B는 작가 A의 작품·회차·설정·자료·이미지·작업을 조회·수정·삭제할 수 없다(모두 404)', async () => {
    const w = await createWork(a);
    const e = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '비밀' })).body;
    const s = (await a.json('POST', `/api/works/${w.id}/settings`, character('하린'))).body;
    const r = (await a.json('POST', `/api/works/${w.id}/resources`, { title: '자료' })).body;
    const job = (await a.json('POST', `/api/works/${w.id}/settings/${s.id}/images`, {})).body;
    await t.api.whenJobsIdle();
    const imageId = (await a.json('GET', `/api/jobs/${job.id}`)).body.result.imageId;
    const w2 = `/api/works/${w.id}`;

    const denied: [string, string, unknown?][] = [
      ['GET', w2], ['PATCH', w2, { title: 'x' }], ['DELETE', w2], ['GET', `${w2}/synopsis`], ['PUT', `${w2}/synopsis`, { content: 'x' }],
      ['GET', `${w2}/episodes`], ['POST', `${w2}/episodes`, { title: 'x' }],
      ['GET', `${w2}/episodes/${e.id}`], ['PATCH', `${w2}/episodes/${e.id}`, { title: 'x' }], ['DELETE', `${w2}/episodes/${e.id}`],
      ['POST', `${w2}/episodes/${e.id}/snapshots`], ['GET', `${w2}/episodes/${e.id}/snapshots`],
      ['PUT', `${w2}/episodes/${e.id}/plot-memo`, { content: 'x' }], ['POST', `${w2}/episodes/${e.id}/complete`],
      ['POST', `${w2}/episodes/${e.id}/ai/continue`, { textBefore: 'x' }],
      ['GET', `${w2}/settings`], ['POST', `${w2}/settings`, character('침입')],
      ['GET', `${w2}/settings/${s.id}`], ['PATCH', `${w2}/settings/${s.id}`, { name: 'x' }], ['DELETE', `${w2}/settings/${s.id}`],
      ['POST', `${w2}/settings/${s.id}/images`, {}], ['GET', `${w2}/settings/${s.id}/images`],
      ['GET', `${w2}/resources`], ['GET', `${w2}/resources/${r.id}`], ['PATCH', `${w2}/resources/${r.id}`, { title: 'x' }], ['DELETE', `${w2}/resources/${r.id}`],
      ['GET', `/api/images/${imageId}`], ['POST', `/api/images/${imageId}/approve`], ['DELETE', `/api/images/${imageId}`],
      ['GET', `/api/jobs/${job.id}`], ['POST', `/api/jobs/${job.id}/retry`],
    ];
    for (const [method, path, body] of denied) {
      const res = await b.json(method, path, body);
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    expect((await b.json('GET', '/api/works')).body).toEqual([]);

    // A의 자원은 그대로다
    expect((await a.json('GET', w2)).body.title).toBe('작품');
    expect((await a.json('GET', `${w2}/episodes/${e.id}`)).body.title).toBe('비밀');
    expect((await a.json('GET', `${w2}/settings/${s.id}`)).body.name).toBe('하린');
  });

  it('존재하지 않는 자원과 남의 자원은 같은 응답이다', async () => {
    const w = await createWork(a);
    const mine = await b.json('GET', `/api/works/${w.id}`);
    const missing = await b.json('GET', '/api/works/does-not-exist');
    expect(mine).toEqual(missing);
  });

  it('같은 작가라도 다른 작품의 자식 자원은 경로를 섞어 접근할 수 없다', async () => {
    const w1 = await createWork(a);
    const w2 = await createWork(a, '둘째');
    const e = (await a.json('POST', `/api/works/${w1.id}/episodes`, { title: 'x' })).body;
    expect((await a.json('GET', `/api/works/${w2.id}/episodes/${e.id}`)).status).toBe(404);
  });
});
