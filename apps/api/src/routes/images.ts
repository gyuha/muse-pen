import type { ImageRecord } from '@muse-pen/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { newId, nowIso } from '../util';
import { type Ctx, type Env, HttpError, me, notFound, ownedSetting, ownedWork, svc, unprocessable } from '../http';

export const imageQualitySchema = z.enum(['draft', 'final']);

const IMAGE_FILES = '/api/image-files/';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const UPLOAD_MODEL_ID = 'user-upload';

export const imagesRoutes = new Hono<Env>();

async function withUrl(c: Ctx, image: ImageRecord) {
  return { ...image, url: await svc(c).storage.getAccessUrl(image.storageKey) };
}

// 이미지는 작가 소유의 비공개 자원이다. 요청한 작가가 작품 소유자일 때만 안다.
function ownedImage(c: Ctx, image: ImageRecord | null): ImageRecord {
  if (!image || !svc(c).repo.getOwnedWork(me(c).id, image.workId)) throw notFound();
  return image;
}

imagesRoutes.get('/works/:workId/settings/:settingId/images', async (c) => {
  const { work, setting } = ownedSetting(c);
  const images = svc(c).repo.listImages(work.id, { targetType: 'setting', targetId: setting.id });
  return c.json(await Promise.all(images.map((i) => withUrl(c, i))));
});

imagesRoutes.get('/images/:imageId', async (c) => c.json(await withUrl(c, ownedImage(c, svc(c).repo.getImage(c.req.param('imageId'))))));

// 권한을 확인한 뒤에만 파일을 내려준다(정적 경로로 공개하지 않는다).
imagesRoutes.get('/image-files/*', async (c) => {
  const key = decodeURIComponent(c.req.path.slice(IMAGE_FILES.length));
  const image = ownedImage(c, svc(c).repo.getImageByKey(key));
  const { data, contentType } = await svc(c).storage.read(image.storageKey);
  return new Response(Buffer.from(data), { headers: { 'content-type': contentType, 'cache-control': 'private, max-age=0' } });
});

// 작가가 승인한 이미지가 그 설정의 대표 이미지가 된다. 이후 모든 생성의 참조 입력이다.
imagesRoutes.post('/images/:imageId/approve', (c) => {
  const image = ownedImage(c, svc(c).repo.getImage(c.req.param('imageId')));
  const { repo } = svc(c);
  const setting = image.targetType === 'setting' ? repo.getSetting(image.workId, image.targetId) : null;
  if (!setting) throw unprocessable('설정 이미지만 승인할 수 있다');
  return c.json(repo.approveImage(setting, image));
});

imagesRoutes.delete('/images/:imageId', async (c) => {
  const image = ownedImage(c, svc(c).repo.getImage(c.req.param('imageId')));
  const { repo, storage } = svc(c);
  repo.transaction((tx) => {
    const work = tx.getOwnedWork(me(c).id, image.workId)!;
    const refs = work.concept.artStylePreset.referenceImageIds;
    if (image.targetType === 'art_style' && refs.includes(image.id)) {
      tx.updateWork(work.id, work.title, { ...work.concept, artStylePreset: { ...work.concept.artStylePreset, referenceImageIds: refs.filter((r) => r !== image.id) } });
    }
    const setting = image.targetType === 'setting' ? tx.getSetting(image.workId, image.targetId) : null;
    if (setting && setting.kind !== 'world' && setting.representativeImageId === image.id) {
      const { id: _i, workId: _w, bodyJson: _j, bodyText: _t, bodyMarkdown: _m, createdAt: _c, updatedAt: _u, ...fields } = setting;
      tx.updateSetting(image.workId, setting.id, { fields: { ...fields, representativeImageId: null } as never });
    }
    tx.deleteImage(image.id);
  });
  await storage.delete(image.storageKey).catch(() => undefined);
  return c.body(null, 204);
});

// 화풍 레퍼런스 이미지 올리기(최대 3장). 올리면 작품의 화풍 프리셋 레퍼런스에 바로 추가된다.
imagesRoutes.post('/works/:workId/art-style-references', async (c) => {
  const work = ownedWork(c);
  const { repo, storage } = svc(c);
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.startsWith('image/')) throw new HttpError(415, '이미지(Content-Type: image/*)만 올릴 수 있다');
  const data = new Uint8Array(await c.req.arrayBuffer());
  if (data.byteLength === 0 || data.byteLength > MAX_UPLOAD_BYTES) throw new HttpError(413, '이미지 크기는 1바이트 이상 10MB 이하여야 한다');
  const preset = work.concept.artStylePreset;
  if (preset.referenceImageIds.length >= 3) throw unprocessable('화풍 레퍼런스 이미지는 최대 3장이다');
  
  const id = newId();
  const record: ImageRecord = { id, workId: work.id, targetType: 'art_style', targetId: work.id, storageKey: `${work.id}/${id}`, isRepresentative: false, modelId: UPLOAD_MODEL_ID, createdAt: nowIso() };
  await storage.save(record.storageKey, { data, contentType });
  repo.transaction((tx) => {
    tx.insertImage(record);
    tx.updateWork(work.id, work.title, { ...work.concept, artStylePreset: { ...preset, referenceImageIds: [...preset.referenceImageIds, id] } });
  });
  return c.json(await withUrl(c, record), 201);
});
