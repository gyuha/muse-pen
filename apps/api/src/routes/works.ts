import { createWorkInputSchema, type Concept, type Id } from '@muse-pen/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { type Env, me, ownedWork, svc, unprocessable, validate } from '../http';

const updateWorkSchema = z.strictObject({ title: z.string().min(1).optional(), concept: createWorkInputSchema.shape.concept.optional() });
const textSchema = z.strictObject({ content: z.string() });
const sideMessageSchema = z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().min(1) });

export const worksRoutes = new Hono<Env>();

// 화풍 레퍼런스는 이 작품에 올린 화풍 이미지여야 한다. 작품을 만들 때는 아직 이미지가 없으므로 비어 있어야 한다.
function checkStyleRefs(c: Parameters<typeof svc>[0], workId: Id | null, concept: Concept): void {
  const ids = concept.artStylePreset.referenceImageIds;
  if (ids.length === 0) return;
  const found = workId ? svc(c).repo.listImagesByIds(workId, ids).filter((i) => i.targetType === 'art_style' && i.targetId === workId) : [];
  if (found.length !== new Set(ids).size) throw unprocessable('화풍 레퍼런스 이미지는 이 작품에 올린 화풍 이미지여야 한다');
}

worksRoutes.get('/works', (c) => c.json(svc(c).repo.listWorks(me(c).id)));

worksRoutes.post('/works', validate('json', createWorkInputSchema), (c) => {
  const input = c.req.valid('json');
  checkStyleRefs(c, null, input.concept);
  return c.json(svc(c).repo.createWork(me(c).id, input.title, input.concept), 201);
});

worksRoutes.get('/works/:workId', (c) => c.json(ownedWork(c)));

worksRoutes.patch('/works/:workId', validate('json', updateWorkSchema), (c) => {
  const work = ownedWork(c);
  const patch = c.req.valid('json');
  const concept = patch.concept ?? work.concept;
  checkStyleRefs(c, work.id, concept);
  return c.json(svc(c).repo.updateWork(work.id, patch.title ?? work.title, concept));
});

worksRoutes.delete('/works/:workId', async (c) => {
  const work = ownedWork(c);
  const { repo, storage } = svc(c);
  const keys = repo.deleteWork(work.id);
  await Promise.all(keys.map((k) => storage.delete(k).catch(() => undefined)));
  return c.body(null, 204);
});

worksRoutes.get('/works/:workId/synopsis', (c) => c.json({ content: svc(c).repo.getSynopsis(ownedWork(c).id) }));

worksRoutes.put('/works/:workId/synopsis', validate('json', textSchema), (c) => {
  const work = ownedWork(c);
  svc(c).repo.putSynopsis(work.id, c.req.valid('json').content);
  return c.json({ content: svc(c).repo.getSynopsis(work.id) });
});

// 사이드 패널 대화는 저장만 한다. AI 컨텍스트에는 들어가지 않는다.
worksRoutes.get('/works/:workId/side-chat', (c) => c.json(svc(c).repo.listSideMessages(ownedWork(c).id)));

worksRoutes.post('/works/:workId/side-chat', validate('json', sideMessageSchema), (c) => {
  const { role, content } = c.req.valid('json');
  return c.json(svc(c).repo.addSideMessage(ownedWork(c).id, role, content), 201);
});

worksRoutes.get('/works/:workId/jobs', (c) => c.json(svc(c).repo.listJobs(ownedWork(c).id)));

