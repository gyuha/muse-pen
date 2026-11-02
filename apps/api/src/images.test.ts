import { FakeImageProvider } from '@muse-pen/image-engine';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { character, createTestApi, createWork, type Client, type TestApi } from './test-utils';

let t: TestApi;
afterEach(() => t?.cleanup());

const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64'));

async function setup() {
  const provider = new FakeImageProvider();
  t = createTestApi({ imageProvider: provider });
  const a = (await t.signUp('a@x.com')).client;
  const b = (await t.signUp('b@x.com')).client;
  const w = await createWork(a);
  const s = (await a.json('POST', `/api/works/${w.id}/settings`, character('하린'))).body;
  return { a, b, w, s, provider };
}

async function generate(a: Client, workId: string, settingId: string) {
  const job = (await a.json('POST', `/api/works/${workId}/settings/${settingId}/images`, { quality: 'draft' })).body;
  await t.api.whenJobsIdle();
  return (await a.json('GET', `/api/jobs/${job.id}`)).body;
}

describe('[AC-14] 이미지', () => {
  it('생성 작업이 파일을 저장소에 쓰고 기록에 모델 ID를 남기며, 사용 기록이 1건 남는다', async () => {
    const { a, w, s } = await setup();
    const job = await generate(a, w.id, s.id);
    expect(job).toMatchObject({ status: 'completed', result: { modelId: 'nano-banana-2.1', mode: 'candidate' } });

    const [image] = (await a.json('GET', `/api/works/${w.id}/settings/${s.id}/images`)).body;
    expect(image).toMatchObject({ id: job.result.imageId, modelId: 'nano-banana-2.1', targetType: 'setting', targetId: s.id, isRepresentative: false });
    expect(existsSync(join(t.imageDir, image.storageKey))).toBe(true); // 로컬 디스크에 저장됨

    const file = await a.req('GET', image.url);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await file.arrayBuffer()).slice(0, 4)).toEqual(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]));

    const usage = (await a.json('GET', '/api/usage')).body;
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ feature: 'image_generation', modelId: 'nano-banana-2.1', usage: { unit: 'images', count: 1 } });
  });

  it('다른 작가는 그 이미지를 받을 수 없고, 로그인하지 않아도 받을 수 없다', async () => {
    const { a, b, w, s } = await setup();
    await generate(a, w.id, s.id);
    const [image] = (await a.json('GET', `/api/works/${w.id}/settings/${s.id}/images`)).body;
    expect((await b.req('GET', image.url)).status).toBe(404);
    expect((await b.json('GET', `/api/images/${image.id}`)).status).toBe(404);
    expect((await t.client().req('GET', image.url)).status).toBe(401);
    expect((await a.req('GET', '/api/image-files/..%2F..%2Fetc%2Fpasswd')).status).toBe(404);
  });

  it('승인한 이미지가 대표 이미지가 되고 다음 생성은 그것을 참조 입력으로 쓴다', async () => {
    const { a, w, s, provider } = await setup();
    const seen: number[] = [];
    const original = provider.generate.bind(provider);
    provider.generate = async (req) => (seen.push(req.referenceImages.length), original(req));

    const first = (await generate(a, w.id, s.id)).result;
    expect(first.mode).toBe('candidate');
    const approved = await a.json('POST', `/api/images/${first.imageId}/approve`);
    expect(approved.body.representativeImageId).toBe(first.imageId);
    expect((await a.json('GET', `/api/images/${first.imageId}`)).body.isRepresentative).toBe(true);

    const second = (await generate(a, w.id, s.id)).result;
    expect(second.mode).toBe('reference');
    expect(seen).toEqual([0, 1]);
    // 새 후보는 자동으로 대표가 되지 않는다
    expect((await a.json('GET', `/api/images/${second.imageId}`)).body.isRepresentative).toBe(false);

    // 대표 이미지는 그 설정의 이미지만 가능
    expect((await a.json('PATCH', `/api/works/${w.id}/settings/${s.id}`, { representativeImageId: 'nope' })).status).toBe(422);
  });

  it('세계관은 이미지를 만들지 않는다', async () => {
    const { a, w } = await setup();
    const world = (await a.json('POST', `/api/works/${w.id}/settings`, { kind: 'world', name: '내공', rulesSummary: '' })).body;
    expect((await a.json('POST', `/api/works/${w.id}/settings/${world.id}/images`, {})).status).toBe(422);
  });

  it('화풍 레퍼런스를 올리면 프리셋에 붙고 이미지 생성에 함께 들어간다. 최대 3장이다', async () => {
    const { a, w, s, provider } = await setup();
    const seen: number[] = [];
    const original = provider.generate.bind(provider);
    provider.generate = async (req) => (seen.push(req.referenceImages.length), original(req));
    const upload = (data: Uint8Array, type = 'image/png') =>
      t.api.app.request(`/api/works/${w.id}/art-style-references`, { method: 'POST', headers: { origin: 'http://localhost:3000', cookie: a.cookie, 'content-type': type }, body: Buffer.from(data) });

    const res = await upload(PNG);
    expect(res.status).toBe(201);
    const image = (await res.json()) as { id: string };
    expect(image).toMatchObject({ targetType: 'art_style', targetId: w.id, modelId: 'user-upload' });
    expect((await a.json('GET', `/api/works/${w.id}`)).body.concept.artStylePreset.referenceImageIds).toEqual([image.id]);
    expect((await upload(PNG, 'text/plain')).status).toBe(415);

    await generate(a, w.id, s.id);
    expect(seen).toEqual([1]);

    await upload(PNG); await upload(PNG);
    expect((await upload(PNG)).status).toBe(422);
    // 레퍼런스를 지우면 프리셋에서도 빠진다
    expect((await a.json('DELETE', `/api/images/${image.id}`)).status).toBe(204);
    expect((await a.json('GET', `/api/works/${w.id}`)).body.concept.artStylePreset.referenceImageIds).toHaveLength(2);
  });

  it('작품·설정을 지우면 이미지 파일도 지운다', async () => {
    const { a, w, s } = await setup();
    await generate(a, w.id, s.id);
    const [image] = (await a.json('GET', `/api/works/${w.id}/settings/${s.id}/images`)).body;
    expect((await a.json('DELETE', `/api/works/${w.id}/settings/${s.id}`)).status).toBe(204);
    expect(existsSync(join(t.imageDir, image.storageKey))).toBe(false);
    expect((await a.json('GET', `/api/images/${image.id}`)).status).toBe(404);
  });
});
