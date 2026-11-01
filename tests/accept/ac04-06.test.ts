import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { concept, createHarness, createWork, para, type Client, type Harness } from './helpers';

let t: Harness;
let a: Client;
beforeEach(async () => {
  t = createHarness();
  a = await t.signUp('a@x.com');
});
afterEach(() => t.cleanup());

describe('[AC-04] 작품 CRUD와 컨셉 5항목', () => {
  it('[AC-04] 작품을 만들면 컨셉 5항목(장르·톤·서술 시점·타깃 독자·화풍 프리셋)이 그대로 저장·조회된다', async () => {
    const input = {
      title: '검의 노래',
      concept: { genre: '로맨스 판타지', tone: '따뜻하고 유머러스', pointOfView: 'first_person', targetReader: '10대 후반 여성', artStylePreset: { prompt: '부드러운 수채화', referenceImageIds: [] } },
    };
    const created = await a.json('POST', '/api/works', input);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject(input);
    expect(created.body.id).toBeTruthy();
    const me = (await a.json('GET', '/api/me')).body;
    expect(created.body.authorId).toBe(me.id);

    const got = await a.json('GET', `/api/works/${created.body.id}`);
    expect(got.status).toBe(200);
    expect(got.body.title).toBe('검의 노래');
    expect(got.body.concept).toEqual(input.concept);
    // DB에서 다시 읽어도 같다
    expect(t.api.services.repo.getOwnedWork(me.id, created.body.id)!.concept).toEqual(input.concept);
  });

  it('[AC-04] 작품 목록은 내 작품만 돌려준다', async () => {
    const w1 = await createWork(a, '첫째');
    const w2 = await createWork(a, '둘째');
    const list = (await a.json('GET', '/api/works')).body as any[];
    expect(list.map((w) => w.id).sort()).toEqual([w1.id, w2.id].sort());
    expect(list.map((w) => w.title).sort()).toEqual(['둘째', '첫째']);
  });

  it('[AC-04] 작품을 고치면 제목과 컨셉이 바뀌고 조회에도 반영된다. 고치지 않은 항목은 유지된다', async () => {
    const w = await createWork(a, '옛 제목');
    const newConcept = { ...concept, genre: '미스터리', tone: '음울', pointOfView: 'first_person', artStylePreset: { prompt: '흑백 판화', referenceImageIds: [] } };
    const patched = await a.json('PATCH', `/api/works/${w.id}`, { title: '새 제목', concept: newConcept });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ id: w.id, title: '새 제목', concept: newConcept });
    const got = (await a.json('GET', `/api/works/${w.id}`)).body;
    expect(got.title).toBe('새 제목');
    expect(got.concept).toEqual(newConcept);

    // 제목만 고치면 컨셉은 그대로
    await a.json('PATCH', `/api/works/${w.id}`, { title: '제목만' });
    const again = (await a.json('GET', `/api/works/${w.id}`)).body;
    expect(again.title).toBe('제목만');
    expect(again.concept).toEqual(newConcept);
  });

  it('[AC-04] 작품을 지우면 조회가 404이고 목록에서 사라지며 딸린 회차·설정·자료도 DB에서 사라진다', async () => {
    const w = await createWork(a);
    await a.json('POST', `/api/works/${w.id}/episodes`, { title: '1화' });
    await a.json('POST', `/api/works/${w.id}/settings`, { kind: 'world', name: '강호', rulesSummary: '규칙' });
    await a.json('POST', `/api/works/${w.id}/resources`, { title: '자료' });
    const repo = t.api.services.repo;
    expect(repo.listEpisodes(w.id)).toHaveLength(1);

    const del = await a.req('DELETE', `/api/works/${w.id}`);
    expect(del.status).toBe(204);
    expect((await a.json('GET', `/api/works/${w.id}`)).status).toBe(404);
    expect((await a.json('GET', '/api/works')).body).toEqual([]);
    expect(repo.listEpisodes(w.id)).toEqual([]);
    expect(repo.listSettings(w.id)).toEqual([]);
    expect(repo.listResources(w.id)).toEqual([]);
    // 한 번 더 지우면 404
    expect((await a.json('DELETE', `/api/works/${w.id}`)).status).toBe(404);
  });

  it('[AC-04] 컨셉 항목이 빠지거나 잘못되면 거절되고 작품이 만들어지지 않는다', async () => {
    const bad: Record<string, unknown>[] = [
      { title: '', concept },
      { title: 'x' },
      { title: 'x', concept: { ...concept, genre: '' } },
      { title: 'x', concept: { ...concept, tone: undefined } },
      { title: 'x', concept: { ...concept, pointOfView: 'second_person' } },
      { title: 'x', concept: { ...concept, targetReader: '' } },
      { title: 'x', concept: { ...concept, artStylePreset: undefined } },
      { title: 'x', concept: { ...concept, artStylePreset: { prompt: '', referenceImageIds: [] } } },
      { title: 'x', concept: { ...concept, unknownField: 1 } },
    ];
    for (const body of bad) {
      const res = await a.json('POST', '/api/works', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect((await a.json('GET', '/api/works')).body).toEqual([]);
  });

  it('[AC-04] 서술 시점은 1인칭·3인칭 둘 다 저장된다', async () => {
    for (const pointOfView of ['first_person', 'third_person']) {
      const r = await a.json('POST', '/api/works', { title: pointOfView, concept: { ...concept, pointOfView } });
      expect(r.status).toBe(201);
      expect((await a.json('GET', `/api/works/${r.body.id}`)).body.concept.pointOfView).toBe(pointOfView);
    }
  });
});

describe('[AC-05] 회차 CRUD와 순서, 본문 파생본', () => {
  it('[AC-05] 회차를 만들고 조회하면 제목·본문 블록 JSON·완료 여부가 저장되어 있다', async () => {
    const w = await createWork(a);
    const bodyJson = [para('첫 문단입니다.'), para('두 번째 문단입니다.')];
    const created = await a.json('POST', `/api/works/${w.id}/episodes`, { title: '1화', bodyJson });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ workId: w.id, order: 1, title: '1화', completed: false });
    const got = (await a.json('GET', `/api/works/${w.id}/episodes/${created.body.id}`)).body;
    expect(got.bodyJson).toEqual(bodyJson);
    const list = (await a.json('GET', `/api/works/${w.id}/episodes`)).body as any[];
    expect(list.map((e) => e.id)).toEqual([created.body.id]);
  });

  it('[AC-05] 본문 블록 JSON을 저장하면 일반 텍스트와 Markdown 파생본이 함께 저장된다(생성·수정 모두)', async () => {
    const w = await createWork(a);
    const e = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '1화', bodyJson: [para('가나다'), para('라마바')] })).body;
    expect(e.bodyText).toContain('가나다');
    expect(e.bodyText).toContain('라마바');
    expect(e.bodyMarkdown).toContain('가나다');
    expect(e.bodyMarkdown).toContain('라마바');

    const newJson = [{ type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: '제목줄' }] }, para('바뀐 본문')];
    const patched = await a.json('PATCH', `/api/works/${w.id}/episodes/${e.id}`, { bodyJson: newJson });
    expect(patched.status).toBe(200);
    expect(patched.body.bodyJson).toEqual(newJson);
    expect(patched.body.bodyText).toContain('제목줄');
    expect(patched.body.bodyText).toContain('바뀐 본문');
    expect(patched.body.bodyText).not.toContain('가나다'); // 파생본이 새 본문을 따라간다
    expect(patched.body.bodyMarkdown).toMatch(/^#{1,6} 제목줄/); // 제목 블록은 Markdown 제목으로
    expect(patched.body.bodyMarkdown).toContain('바뀐 본문');

    // DB에서 다시 읽어도 세 가지 모두 저장되어 있다
    const stored = t.api.services.repo.getEpisode(w.id, e.id)!;
    expect(stored.bodyJson).toEqual(newJson);
    expect(stored.bodyText).toBe(patched.body.bodyText);
    expect(stored.bodyMarkdown).toBe(patched.body.bodyMarkdown);
  });

  it('[AC-05] 본문 없이 만든 회차는 빈 파생본을 가진다', async () => {
    const w = await createWork(a);
    const e = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '빈 회차' })).body;
    expect(e.bodyText).toBe('');
    expect(e.bodyMarkdown).toBe('');
  });

  it('[AC-05] 제목·완료 여부를 고칠 수 있고 본문은 그대로 유지된다', async () => {
    const w = await createWork(a);
    const e = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '옛', bodyJson: [para('본문 유지')] })).body;
    const p = await a.json('PATCH', `/api/works/${w.id}/episodes/${e.id}`, { title: '새', completed: true });
    expect(p.status).toBe(200);
    expect(p.body).toMatchObject({ title: '새', completed: true, bodyText: '본문 유지' });
  });

  it('[AC-05] 회차 순서가 유지된다: 만든 순서대로 1..n, 목록도 순서대로', async () => {
    const w = await createWork(a);
    const ids: string[] = [];
    for (const title of ['1화', '2화', '3화']) ids.push((await a.json('POST', `/api/works/${w.id}/episodes`, { title })).body.id);
    const list = (await a.json('GET', `/api/works/${w.id}/episodes`)).body as any[];
    expect(list.map((e) => [e.title, e.order])).toEqual([['1화', 1], ['2화', 2], ['3화', 3]]);
  });

  it('[AC-05] 순서를 지정해 끼워 넣으면 뒤 회차가 밀리고, 순서를 바꾸면 목록 순서가 바뀐다', async () => {
    const w = await createWork(a);
    const mk = async (title: string, order?: number) => (await a.json('POST', `/api/works/${w.id}/episodes`, { title, ...(order ? { order } : {}) })).body;
    const e1 = await mk('A');
    const e2 = await mk('B');
    const inserted = await mk('끼움', 2);
    expect(inserted.order).toBe(2);
    let list = (await a.json('GET', `/api/works/${w.id}/episodes`)).body as any[];
    expect(list.map((e) => [e.title, e.order])).toEqual([['A', 1], ['끼움', 2], ['B', 3]]);

    await a.json('PATCH', `/api/works/${w.id}/episodes/${e1.id}`, { order: 3 });
    list = (await a.json('GET', `/api/works/${w.id}/episodes`)).body as any[];
    expect(list.map((e) => e.title)).toEqual(['끼움', 'B', 'A']);
    expect(list.map((e) => e.order)).toEqual([1, 2, 3]);
    expect(e2.id).toBeTruthy();
  });

  it('[AC-05] 회차를 지우면 조회가 404이고 나머지 회차의 순서는 빈틈 없이 유지된다', async () => {
    const w = await createWork(a);
    const ids: string[] = [];
    for (const title of ['1화', '2화', '3화']) ids.push((await a.json('POST', `/api/works/${w.id}/episodes`, { title })).body.id);
    expect((await a.req('DELETE', `/api/works/${w.id}/episodes/${ids[1]}`)).status).toBe(204);
    expect((await a.json('GET', `/api/works/${w.id}/episodes/${ids[1]}`)).status).toBe(404);
    const list = (await a.json('GET', `/api/works/${w.id}/episodes`)).body as any[];
    expect(list.map((e) => [e.title, e.order])).toEqual([['1화', 1], ['3화', 2]]);
    expect(t.api.services.repo.getEpisode(w.id, ids[1]!)).toBeFalsy();
  });

  it('[AC-05] 잘못된 순서(0·음수·소수)와 정의되지 않은 필드는 거절된다', async () => {
    const w = await createWork(a);
    const e = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '1화' })).body;
    for (const order of [0, -1, 1.5]) {
      expect((await a.json('PATCH', `/api/works/${w.id}/episodes/${e.id}`, { order })).status).toBe(400);
    }
    expect((await a.json('PATCH', `/api/works/${w.id}/episodes/${e.id}`, { bodyText: '직접 쓰기' })).status).toBe(400);
    expect((await a.json('GET', `/api/works/${w.id}/episodes/${e.id}`)).body.bodyText).toBe('');
  });
});

describe('[AC-06] 회차 스냅샷과 복원', () => {
  async function setup() {
    const w = await createWork(a);
    const e = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '원래 제목', bodyJson: [para('처음 본문')] })).body;
    return { w, e, base: `/api/works/${w.id}/episodes/${e.id}` };
  }

  it('[AC-06] 스냅샷을 만들면 그 시점 본문이 담기고 목록에 나온다', async () => {
    const { base, e } = await setup();
    const snap = await a.json('POST', `${base}/snapshots`);
    expect(snap.status).toBe(201);
    expect(snap.body.id).toBeTruthy();
    expect(snap.body.bodyText).toBe('처음 본문');
    expect(snap.body.bodyJson).toEqual([para('처음 본문')]);
    const list = (await a.json('GET', `${base}/snapshots`)).body as any[];
    expect(list.map((s) => s.id)).toEqual([snap.body.id]);
    expect(t.api.services.repo.listSnapshots(e.id)).toHaveLength(1);
  });

  it('[AC-06] 스냅샷 뒤에 본문을 고쳐도 스냅샷 내용은 변하지 않고, 스냅샷이 쌓인다', async () => {
    const { base } = await setup();
    const s1 = (await a.json('POST', `${base}/snapshots`)).body;
    await a.json('PATCH', base, { bodyJson: [para('고친 본문')] });
    const s2 = (await a.json('POST', `${base}/snapshots`)).body;
    expect(s2.bodyText).toBe('고친 본문');
    const list = (await a.json('GET', `${base}/snapshots`)).body as any[];
    expect(list.map((s) => s.id).sort()).toEqual([s1.id, s2.id].sort());
    expect(list.find((s) => s.id === s1.id).bodyText).toBe('처음 본문');
  });

  it('[AC-06] 특정 스냅샷으로 복원하면 회차 본문(JSON·텍스트·Markdown)이 그 시점과 같아진다', async () => {
    const { w, e, base } = await setup();
    const s1 = (await a.json('POST', `${base}/snapshots`)).body;
    await a.json('PATCH', base, { title: '바뀐 제목', bodyJson: [para('완전히 다른 본문'), para('둘째 문단')] });
    expect((await a.json('GET', base)).body.bodyText).toContain('완전히 다른 본문');

    const restored = await a.json('POST', `${base}/snapshots/${s1.id}/restore`);
    expect(restored.status).toBe(200);
    const got = (await a.json('GET', base)).body;
    expect(got.bodyJson).toEqual([para('처음 본문')]);
    expect(got.bodyText).toBe('처음 본문');
    expect(got.bodyMarkdown).toBe(s1.bodyMarkdown);
    expect(got.title).toBe('원래 제목');
    const stored = t.api.services.repo.getEpisode(w.id, e.id)!;
    expect(stored.bodyJson).toEqual([para('처음 본문')]);
    expect(stored.bodyText).toBe('처음 본문');
  });

  it('[AC-06] 복원해도 스냅샷은 사라지지 않는다. 두 번째 스냅샷으로도 되돌릴 수 있다', async () => {
    const { base } = await setup();
    const s1 = (await a.json('POST', `${base}/snapshots`)).body;
    await a.json('PATCH', base, { bodyJson: [para('2번째 본문')] });
    const s2 = (await a.json('POST', `${base}/snapshots`)).body;
    await a.json('POST', `${base}/snapshots/${s1.id}/restore`);
    const ids = ((await a.json('GET', `${base}/snapshots`)).body as any[]).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([s1.id, s2.id]));
    await a.json('POST', `${base}/snapshots/${s2.id}/restore`);
    expect((await a.json('GET', base)).body.bodyText).toBe('2번째 본문');
  });

  it('[AC-06] 없는 스냅샷·다른 회차의 스냅샷으로는 복원할 수 없고 본문은 그대로다', async () => {
    const { w, base } = await setup();
    const e2 = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '둘째', bodyJson: [para('둘째 본문')] })).body;
    const other = (await a.json('POST', `/api/works/${w.id}/episodes/${e2.id}/snapshots`)).body;
    expect((await a.json('POST', `${base}/snapshots/nope/restore`)).status).toBe(404);
    expect((await a.json('POST', `${base}/snapshots/${other.id}/restore`)).status).toBe(404);
    expect((await a.json('GET', base)).body.bodyText).toBe('처음 본문');
  });
});
