import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { character, createTestApi, createWork, type Client, type TestApi } from './test-utils';

let t: TestApi;
let a: Client;
let workId: string;
let url: string;
beforeEach(async () => {
  t = createTestApi();
  a = (await t.signUp('a@x.com')).client;
  workId = (await createWork(a)).id;
  url = `/api/works/${workId}/settings`;
});
afterEach(() => t.cleanup());

const location = { kind: 'location', name: '객잔', placeType: '여관', eraMoodKeywords: ['고풍'], representativeImageId: null };
const world = { kind: 'world', name: '내공', rulesSummary: '내공은 단전에 쌓인다' };

describe('[AC-07] 설정 4종', () => {
  it('4종을 CRUD할 수 있다', async () => {
    const c = await a.json('POST', url, { ...character('하린', { aliases: ['린'] }), bodyJson: [{ type: 'paragraph', content: [{ type: 'text', text: '과거사' }] }] });
    expect(c.status).toBe(201);
    expect(c.body).toMatchObject({ kind: 'character', name: '하린', aliases: ['린'], bodyText: '과거사' });
    const prop = await a.json('POST', url, { kind: 'prop', name: '검', ownerCharacterId: c.body.id, appearanceKeywords: ['은빛'], representativeImageId: null });
    expect(prop.status).toBe(201);
    expect((await a.json('POST', url, location)).status).toBe(201);
    expect((await a.json('POST', url, world)).status).toBe(201);

    expect((await a.json('GET', url)).body).toHaveLength(4);
    expect((await a.json('GET', `${url}?kind=character`)).body.map((s: any) => s.name)).toEqual(['하린']);

    const patched = await a.json('PATCH', `${url}/${c.body.id}`, { status: 'dead', bodyJson: [] });
    expect(patched.body).toMatchObject({ status: 'dead', name: '하린', aliases: ['린'], bodyText: '' });
    expect((await a.json('DELETE', `${url}/${c.body.id}`)).status).toBe(204);
    // 캐릭터를 지우면 소품의 소유자는 비워진다
    expect((await a.json('GET', `${url}/${prop.body.id}`)).body.ownerCharacterId).toBeNull();
  });

  it('종류별로 정의되지 않은 필드는 거부한다', async () => {
    expect((await a.json('POST', url, character('하린', { nickname: 'x' }))).status).toBe(400);
    expect((await a.json('POST', url, { ...world, representativeImageId: null })).status).toBe(400);
    expect((await a.json('POST', url, { ...location, status: 'alive' })).status).toBe(400);
    expect((await a.json('POST', url, { kind: 'item', name: 'x' })).status).toBe(400);
    const c = (await a.json('POST', url, character('하린'))).body;
    expect((await a.json('PATCH', `${url}/${c.id}`, { hobby: '검' })).status).toBe(400);
    expect((await a.json('PATCH', `${url}/${c.id}`, { kind: 'world' })).status).toBe(400);
  });

  it('캐릭터 상태는 생존·사망·행방불명만 허용한다', async () => {
    for (const status of ['alive', 'dead', 'missing']) expect((await a.json('POST', url, character(`c-${status}`, { status }))).status).toBe(201);
    expect((await a.json('POST', url, character('x', { status: 'unknown' }))).status).toBe(400);
  });

  it('소품 소유자는 같은 작품의 캐릭터만 지정할 수 있다', async () => {
    const other = await createWork(a, '다른 작품');
    const foreign = (await a.json('POST', `/api/works/${other.id}/settings`, character('타인'))).body;
    const loc = (await a.json('POST', url, location)).body;
    const prop = (owner: string | null) => ({ kind: 'prop', name: '검', ownerCharacterId: owner, appearanceKeywords: [], representativeImageId: null });
    expect((await a.json('POST', url, prop(foreign.id))).status).toBe(422);
    expect((await a.json('POST', url, prop(loc.id))).status).toBe(422);
    expect((await a.json('POST', url, prop('nope'))).status).toBe(422);
    expect((await a.json('POST', url, prop(null))).status).toBe(201);
  });
});
