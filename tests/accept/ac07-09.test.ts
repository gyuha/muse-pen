import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { character, createHarness, createWork, location, para, prop, world, type Client, type Harness } from './helpers';

let t: Harness;
let a: Client;
let wid: string;
beforeEach(async () => {
  t = createHarness();
  a = await t.signUp('a@x.com');
  wid = (await createWork(a)).id;
});
afterEach(() => t.cleanup());

const S = () => `/api/works/${wid}/settings`;

describe('[AC-07] 설정 4종 CRUD와 필드 검증', () => {
  const samples: [string, Record<string, unknown>, Record<string, unknown>][] = [
    ['character', character('하린', { aliases: ['린'], appearanceKeywords: ['흑발', '검은 눈'] }), { name: '하린이', gender: '남', ageGroup: '30대', aliases: ['린', '하'] }],
    ['location', location('청풍객잔', { placeType: '객잔', eraMoodKeywords: ['고풍', '소란'] }), { name: '청풍각', placeType: '누각' }],
    ['prop', prop('청룡검', { appearanceKeywords: ['푸른 날'] }), { name: '청룡도', appearanceKeywords: ['푸른 날', '용 문양'] }],
    ['world', world('강호', { rulesSummary: '내공이 있다' }), { name: '무림', rulesSummary: '내공과 외공이 있다' }],
  ];

  for (const [kind, input, patch] of samples) {
    it(`[AC-07] ${kind}: 만들고·조회하고·고치고·지울 수 있다`, async () => {
      const created = await a.json('POST', S(), input);
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject(input);
      expect(created.body.workId).toBe(wid);
      const id = created.body.id as string;

      const got = (await a.json('GET', `${S()}/${id}`)).body;
      expect(got).toMatchObject(input);
      expect(((await a.json('GET', S())).body as any[]).map((s) => s.id)).toContain(id);
      expect(((await a.json('GET', `${S()}?kind=${kind}`)).body as any[]).map((s) => s.id)).toEqual([id]);

      const patched = await a.json('PATCH', `${S()}/${id}`, patch);
      expect(patched.status).toBe(200);
      expect(patched.body).toMatchObject({ ...input, ...patch });
      expect(t.api.services.repo.getSetting(wid, id)).toMatchObject({ ...input, ...patch });

      expect((await a.req('DELETE', `${S()}/${id}`)).status).toBe(204);
      expect((await a.json('GET', `${S()}/${id}`)).status).toBe(404);
      expect(t.api.services.repo.getSetting(wid, id)).toBeFalsy();
    });
  }

  it('[AC-07] 설정 본문(블록 JSON)을 저장하면 텍스트·Markdown 파생본도 저장된다', async () => {
    const c = (await a.json('POST', S(), { ...character('하린'), bodyJson: [para('하린은 검객이다.')] })).body;
    expect(c.bodyJson).toEqual([para('하린은 검객이다.')]);
    expect(c.bodyText).toContain('하린은 검객이다.');
    expect(c.bodyMarkdown).toContain('하린은 검객이다.');
    const p = (await a.json('PATCH', `${S()}/${c.id}`, { bodyJson: [para('이제 마법사다.')] })).body;
    expect(p.bodyText).toContain('이제 마법사다.');
    expect(p.bodyText).not.toContain('검객');
  });

  it('[AC-07] 종류별로 정의되지 않은 필드는 거부된다(생성): 임의 필드·다른 종류의 필드', async () => {
    const bad: Record<string, unknown>[] = [
      character('x', { favoriteFood: '국수' }),
      location('x', { status: 'alive' }),
      location('x', { gender: '여' }),
      prop('x', { placeType: '객잔' }),
      prop('x', { aliases: ['y'] }),
      world('x', { appearanceKeywords: ['a'] }),
      world('x', { ownerCharacterId: null }),
      { kind: 'tool', name: 'x' }, // 정의되지 않은 종류
      { name: '종류 없음' },
    ];
    for (const body of bad) {
      const res = await a.json('POST', S(), body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect((await a.json('GET', S())).body).toEqual([]); // 아무것도 저장되지 않았다
  });

  it('[AC-07] 필수 필드가 빠지거나 이름이 비면 거부된다', async () => {
    const { gender: _g, ...noGender } = character('x');
    for (const body of [noGender, character(''), { ...location('x'), placeType: undefined }, { kind: 'world', name: 'x' }]) {
      expect((await a.json('POST', S(), body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('[AC-07] 수정에서도 정의되지 않은 필드는 거부되고 값은 바뀌지 않는다. 종류는 바꿀 수 없다', async () => {
    const c = (await a.json('POST', S(), character('하린'))).body;
    const l = (await a.json('POST', S(), location('객잔'))).body;
    expect((await a.json('PATCH', `${S()}/${c.id}`, { favoriteFood: '국수' })).status).toBe(400);
    expect((await a.json('PATCH', `${S()}/${l.id}`, { status: 'dead' })).status).toBe(400);
    expect((await a.json('PATCH', `${S()}/${c.id}`, { kind: 'location' })).status).toBe(400);
    expect(t.api.services.repo.getSetting(wid, c.id)).toMatchObject({ kind: 'character', name: '하린' });
    expect(t.api.services.repo.getSetting(wid, l.id)).toMatchObject({ kind: 'location', name: '객잔' });
    expect((t.api.services.repo.getSetting(wid, l.id) as any).status).toBeUndefined();
  });

  it('[AC-07] 캐릭터 상태는 생존·사망·행방불명만 허용된다(저장 값 alive·dead·missing)', async () => {
    for (const status of ['alive', 'dead', 'missing']) {
      const r = await a.json('POST', S(), character(`c-${status}`, { status }));
      expect(r.status, status).toBe(201);
      expect(r.body.status).toBe(status);
    }
    for (const status of ['zombie', '사망', 'DEAD', '', null, 1]) {
      const r = await a.json('POST', S(), character('나쁜상태', { status }));
      expect(r.status, String(status)).toBe(400);
    }
    expect(((await a.json('GET', S())).body as any[]).map((s) => s.name).sort()).toEqual(['c-alive', 'c-dead', 'c-missing']);

    // 수정에서도 같다
    const c = (await a.json('GET', `${S()}?kind=character`)).body[0];
    expect((await a.json('PATCH', `${S()}/${c.id}`, { status: 'ghost' })).status).toBe(400);
    expect(t.api.services.repo.getSetting(wid, c.id)).toMatchObject({ status: c.status });
    expect((await a.json('PATCH', `${S()}/${c.id}`, { status: 'missing' })).body.status).toBe('missing');
  });

  it('[AC-07] 소품 소유자는 같은 작품의 캐릭터만 지정할 수 있다', async () => {
    const owner = (await a.json('POST', S(), character('하린'))).body;
    const place = (await a.json('POST', S(), location('객잔'))).body;
    const otherWork = (await createWork(a, '다른 작품')).id;
    const foreign = (await a.json('POST', `/api/works/${otherWork}/settings`, character('남의 캐릭터'))).body;

    const ok = await a.json('POST', S(), prop('검', { ownerCharacterId: owner.id }));
    expect(ok.status).toBe(201);
    expect(ok.body.ownerCharacterId).toBe(owner.id);
    expect((await a.json('GET', `${S()}/${ok.body.id}`)).body.ownerCharacterId).toBe(owner.id);

    for (const [label, ownerCharacterId] of [['다른 작품의 캐릭터', foreign.id], ['같은 작품의 장소', place.id], ['없는 ID', 'nope']] as const) {
      const r = await a.json('POST', S(), prop('나쁜 소품', { ownerCharacterId }));
      expect([400, 422], label).toContain(r.status);
    }
    expect(((await a.json('GET', `${S()}?kind=prop`)).body as any[]).map((s) => s.name)).toEqual(['검']);

    // 수정으로 소유자를 바꿀 때도 같은 규칙
    const bad = await a.json('PATCH', `${S()}/${ok.body.id}`, { ownerCharacterId: foreign.id });
    expect([400, 422]).toContain(bad.status);
    expect(t.api.services.repo.getSetting(wid, ok.body.id)).toMatchObject({ ownerCharacterId: owner.id });
    const cleared = await a.json('PATCH', `${S()}/${ok.body.id}`, { ownerCharacterId: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.ownerCharacterId).toBeNull();
  });

  it('[AC-07] 설정은 만든 작품 안에서만 보인다', async () => {
    const c = (await a.json('POST', S(), character('하린'))).body;
    const other = (await createWork(a, '다른 작품')).id;
    expect((await a.json('GET', `/api/works/${other}/settings`)).body).toEqual([]);
    expect((await a.json('GET', `/api/works/${other}/settings/${c.id}`)).status).toBe(404);
  });
});

describe('[AC-08] 시놉시스·플롯 메모·고정 설정', () => {
  async function ep(title = '1화') {
    return (await a.json('POST', `/api/works/${wid}/episodes`, { title })).body;
  }

  it('[AC-08] 시놉시스는 작품마다 하나다: 만들고 고치면 최신 값 하나만 남는다', async () => {
    expect((await a.json('GET', `/api/works/${wid}/synopsis`)).body).toEqual({ content: '' });
    const put1 = await a.json('PUT', `/api/works/${wid}/synopsis`, { content: '복수극의 시작' });
    expect(put1.status).toBe(200);
    expect(put1.body.content).toBe('복수극의 시작');
    await a.json('PUT', `/api/works/${wid}/synopsis`, { content: '고친 시놉시스' });
    expect((await a.json('GET', `/api/works/${wid}/synopsis`)).body.content).toBe('고친 시놉시스');
    expect(t.api.services.repo.getSynopsis(wid)).toBe('고친 시놉시스');

    const other = (await createWork(a, '다른 작품')).id;
    expect((await a.json('GET', `/api/works/${other}/synopsis`)).body.content).toBe(''); // 작품 간 섞이지 않는다
  });

  it('[AC-08] 플롯 메모는 회차마다 하나다: 회차별로 따로 저장·수정된다', async () => {
    const e1 = await ep('1화');
    const e2 = await ep('2화');
    const p = (id: string) => `/api/works/${wid}/episodes/${id}/plot-memo`;
    expect((await a.json('GET', p(e1.id))).body).toEqual({ content: '' });
    await a.json('PUT', p(e1.id), { content: '1화: 주인공이 도착한다' });
    await a.json('PUT', p(e2.id), { content: '2화: 결투' });
    await a.json('PUT', p(e1.id), { content: '1화: 수정된 메모' });
    expect((await a.json('GET', p(e1.id))).body.content).toBe('1화: 수정된 메모');
    expect((await a.json('GET', p(e2.id))).body.content).toBe('2화: 결투');
    expect(t.api.services.repo.getPlotMemo(e1.id)).toBe('1화: 수정된 메모');
  });

  it('[AC-08] 고정 설정: 회차에 설정을 연결하고 고치면(교체) 연결이 그대로 바뀐다', async () => {
    const e = await ep();
    const c1 = (await a.json('POST', S(), character('하린'))).body;
    const c2 = (await a.json('POST', S(), location('객잔'))).body;
    const url = `/api/works/${wid}/episodes/${e.id}/pinned-settings`;
    expect((await a.json('GET', url)).body).toEqual({ ids: [] });
    const set = await a.json('PUT', url, { ids: [c1.id, c2.id] });
    expect(set.status).toBe(200);
    expect([...set.body.ids].sort()).toEqual([c1.id, c2.id].sort());
    expect([...t.api.services.repo.getPinnedSettingIds(e.id)].sort()).toEqual([c1.id, c2.id].sort());
    await a.json('PUT', url, { ids: [c2.id] });
    expect((await a.json('GET', url)).body.ids).toEqual([c2.id]);
    await a.json('PUT', url, { ids: [] });
    expect((await a.json('GET', url)).body.ids).toEqual([]);
  });

  it('[AC-08] 고정 설정은 회차마다 따로이고, 다른 작품의 설정은 고정할 수 없다', async () => {
    const e1 = await ep('1화');
    const e2 = await ep('2화');
    const c = (await a.json('POST', S(), character('하린'))).body;
    const other = (await createWork(a, '다른 작품')).id;
    const foreign = (await a.json('POST', `/api/works/${other}/settings`, character('남'))).body;
    const u = (id: string) => `/api/works/${wid}/episodes/${id}/pinned-settings`;
    await a.json('PUT', u(e1.id), { ids: [c.id] });
    expect((await a.json('GET', u(e2.id))).body.ids).toEqual([]);
    const bad = await a.json('PUT', u(e1.id), { ids: [foreign.id] });
    expect([400, 422]).toContain(bad.status);
    expect((await a.json('GET', u(e1.id))).body.ids).toEqual([c.id]); // 거절되면 기존 연결 유지
  });

  it('[AC-08] 설정을 지우면 그 설정의 고정 연결도 사라진다', async () => {
    const e = await ep();
    const c = (await a.json('POST', S(), character('하린'))).body;
    const u = `/api/works/${wid}/episodes/${e.id}/pinned-settings`;
    await a.json('PUT', u, { ids: [c.id] });
    await a.json('DELETE', `${S()}/${c.id}`);
    expect((await a.json('GET', u)).body.ids).toEqual([]);
  });
});

describe('[AC-09] 자료 CRUD와 저장 규칙', () => {
  const R = () => `/api/works/${wid}/resources`;
  const src = (quote: string, over: Record<string, unknown> = {}) => ({ url: 'https://example.com/a', title: '출처', quote, retrievedAt: '2026-01-01T00:00:00.000Z', ...over });

  it('[AC-09] 자료를 만들고·조회하고·고치고·지울 수 있다(출처·태그·미검증 표시 포함)', async () => {
    const input = { title: '조선 시대 복식', question: '조선 시대 남성 복식은?', summary: '도포와 갓', unverified: true, sources: [src('인용문')], tags: ['복식', '조선'] };
    const created = await a.json('POST', R(), input);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ ...input, workId: wid });
    const id = created.body.id as string;
    expect((await a.json('GET', `${R()}/${id}`)).body).toMatchObject(input);
    expect(((await a.json('GET', R())).body as any[]).map((r) => r.id)).toEqual([id]);

    const patched = await a.json('PATCH', `${R()}/${id}`, { title: '수정 제목', summary: '검증됨', unverified: false, tags: ['복식'] });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ title: '수정 제목', summary: '검증됨', unverified: false, tags: ['복식'], question: input.question });
    expect(patched.body.sources).toEqual(input.sources); // 고치지 않은 출처는 유지
    expect(t.api.services.repo.getResource(wid, id)).toMatchObject({ title: '수정 제목', unverified: false });

    expect((await a.req('DELETE', `${R()}/${id}`)).status).toBe(204);
    expect((await a.json('GET', `${R()}/${id}`)).status).toBe(404);
    expect(t.api.services.repo.getResource(wid, id)).toBeFalsy();
  });

  it('[AC-09] 출처 인용이 150자면 저장되고 151자를 넘으면 거부된다(생성)', async () => {
    const ok = await a.json('POST', R(), { title: '경계', sources: [src('가'.repeat(150))] });
    expect(ok.status).toBe(201);
    expect(ok.body.sources[0].quote).toHaveLength(150);
    const over = await a.json('POST', R(), { title: '초과', sources: [src('가'.repeat(151))] });
    expect(over.status).toBe(400);
    expect(((await a.json('GET', R())).body as any[]).map((r) => r.title)).toEqual(['경계']); // 초과 자료는 저장되지 않았다
  });

  it('[AC-09] 수정으로 인용을 150자 넘게 바꾸는 것도 거부되고 기존 값이 유지된다. 여러 출처 중 하나만 넘어도 거부된다', async () => {
    const r = (await a.json('POST', R(), { title: 't', sources: [src('짧은 인용')] })).body;
    const bad = await a.json('PATCH', `${R()}/${r.id}`, { sources: [src('나'.repeat(200))] });
    expect(bad.status).toBe(400);
    expect(t.api.services.repo.getResource(wid, r.id)!.sources[0]!.quote).toBe('짧은 인용');
    const mixed = await a.json('POST', R(), { title: 'm', sources: [src('ok'), src('다'.repeat(151))] });
    expect(mixed.status).toBe(400);
  });

  it('[AC-09] 웹 원문을 담는 필드는 없다: 원문성 필드를 보내면 거부되고 응답·DB 어디에도 저장되지 않는다', async () => {
    const RAW = '웹 페이지 원문 전체 '.repeat(50);
    for (const field of ['content', 'rawText', 'body', 'html', 'pageText', 'fullText', 'rawContent']) {
      const res = await a.json('POST', R(), { title: '원문', [field]: RAW });
      expect(res.status, field).toBe(400);
    }
    expect((await a.json('POST', R(), { title: '원문', sources: [{ ...src('q'), content: RAW }] })).status).toBe(400);
    expect((await a.json('GET', R())).body).toEqual([]);

    const ok = (await a.json('POST', R(), { title: '정상', sources: [src('q')] })).body;
    const keys = Object.keys(ok).sort();
    expect(keys).toEqual(['createdAt', 'id', 'question', 'sources', 'summary', 'tags', 'title', 'unverified', 'updatedAt', 'workId']);
    expect(Object.keys(ok.sources[0]).sort()).toEqual(['quote', 'retrievedAt', 'title', 'url']);
    expect((await a.json('PATCH', `${R()}/${ok.id}`, { content: RAW })).status).toBe(400);
  });

  it('[AC-09] 제목이 비었거나 출처 URL이 올바르지 않으면 거부된다', async () => {
    expect((await a.json('POST', R(), { title: '' })).status).toBe(400);
    expect((await a.json('POST', R(), { summary: '제목 없음' })).status).toBe(400);
    expect((await a.json('POST', R(), { title: 'x', sources: [src('q', { url: 'not a url' })] })).status).toBe(400);
  });

  it('[AC-09] 고정 자료: 회차에 자료를 연결할 수 있고 다른 작품의 자료는 고정할 수 없다', async () => {
    const e = (await a.json('POST', `/api/works/${wid}/episodes`, { title: '1화' })).body;
    const r = (await a.json('POST', R(), { title: '자료' })).body;
    const other = (await createWork(a, '다른 작품')).id;
    const foreign = (await a.json('POST', `/api/works/${other}/resources`, { title: '남의 자료' })).body;
    const u = `/api/works/${wid}/episodes/${e.id}/pinned-resources`;
    expect((await a.json('PUT', u, { ids: [r.id] })).body.ids).toEqual([r.id]);
    expect([400, 422]).toContain((await a.json('PUT', u, { ids: [foreign.id] })).status);
    expect((await a.json('GET', u)).body.ids).toEqual([r.id]);
  });
});
