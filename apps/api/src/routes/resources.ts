import { resourceSchema } from '@muse-pen/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { type Env, notFound, ownedWork, svc, validate } from '../http';

// 웹 원문을 담는 필드는 없다. 정의되지 않은 필드는 거부하고, 출처 인용은 150자 이하만 받는다.
const { id: _id, workId: _workId, createdAt: _created, updatedAt: _updated, ...shape } = resourceSchema.shape;
const createSchema = z.strictObject({
  ...shape,
  question: z.string().default(''),
  summary: z.string().default(''),
  unverified: z.boolean().default(false),
  sources: shape.sources.default([]),
  tags: shape.tags.default([]),
});
const patchSchema = z.strictObject({
  title: shape.title.optional(), question: shape.question.optional(), summary: shape.summary.optional(),
  unverified: shape.unverified.optional(), sources: shape.sources.optional(), tags: shape.tags.optional(),
});

export const resourcesRoutes = new Hono<Env>();

resourcesRoutes.get('/works/:workId/resources', (c) => c.json(svc(c).repo.listResources(ownedWork(c).id)));

resourcesRoutes.post('/works/:workId/resources', validate('json', createSchema), (c) =>
  c.json(svc(c).repo.createResource(ownedWork(c).id, c.req.valid('json')), 201),
);

function ownedResource(c: Parameters<typeof ownedWork>[0]) {
  const work = ownedWork(c);
  const resource = svc(c).repo.getResource(work.id, c.req.param('resourceId') ?? '');
  if (!resource) throw notFound();
  return { work, resource };
}

resourcesRoutes.get('/works/:workId/resources/:resourceId', (c) => c.json(ownedResource(c).resource));

resourcesRoutes.patch('/works/:workId/resources/:resourceId', validate('json', patchSchema), (c) => {
  const { work, resource } = ownedResource(c);
  const { id: _i, workId: _w, createdAt: _c, updatedAt: _u, ...current } = resource;
  return c.json(svc(c).repo.updateResource(work.id, resource.id, { ...current, ...c.req.valid('json') }));
});

resourcesRoutes.delete('/works/:workId/resources/:resourceId', (c) => {
  svc(c).repo.deleteResource(ownedResource(c).resource.id);
  return c.body(null, 204);
});
