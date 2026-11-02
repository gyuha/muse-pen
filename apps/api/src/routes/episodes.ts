import { Hono } from 'hono';
import { z } from 'zod';
import { type Env, notFound, ownedEpisode, ownedWork, svc, unprocessable, validate } from '../http';

const createSchema = z.strictObject({ title: z.string().default(''), bodyJson: z.unknown().optional(), order: z.number().int().positive().optional() });
const patchSchema = z.strictObject({
  title: z.string().optional(), bodyJson: z.unknown().optional(), order: z.number().int().positive().optional(), completed: z.boolean().optional(),
});
const textSchema = z.strictObject({ content: z.string() });
const idsSchema = z.strictObject({ ids: z.array(z.string()) });

export const episodesRoutes = new Hono<Env>()

.get('/works/:workId/episodes', (c) => c.json(svc(c).repo.listEpisodes(ownedWork(c).id)))

.post('/works/:workId/episodes', validate('json', createSchema), (c) => {
  const work = ownedWork(c);
  const input = c.req.valid('json');
  const { repo, deriver } = svc(c);
  const derived = deriver.derive(input.bodyJson);
  return c.json(repo.createEpisode(work.id, { title: input.title, body: { ...derived, bodyJson: input.bodyJson ?? null }, order: input.order }), 201);
})

.get('/works/:workId/episodes/:episodeId', (c) => c.json(ownedEpisode(c).episode))

// 본문 블록 JSON을 저장할 때마다 일반 텍스트·Markdown 파생본을 함께 저장한다.
.patch('/works/:workId/episodes/:episodeId', validate('json', patchSchema), (c) => {
  const { work, episode } = ownedEpisode(c);
  const patch = c.req.valid('json');
  const { repo, deriver } = svc(c);
  const body = 'bodyJson' in patch ? { ...deriver.derive(patch.bodyJson), bodyJson: patch.bodyJson ?? null } : undefined;
  return c.json(repo.updateEpisode(work.id, episode.id, { title: patch.title, body, completed: patch.completed, order: patch.order }));
})

.delete('/works/:workId/episodes/:episodeId', (c) => {
  const { work, episode } = ownedEpisode(c);
  svc(c).repo.deleteEpisode(work.id, episode.id);
  return c.body(null, 204);
})

// --- 플롯 메모·회차 요약 ---
.get('/works/:workId/episodes/:episodeId/plot-memo', (c) => c.json({ content: svc(c).repo.getPlotMemo(ownedEpisode(c).episode.id) }))

.put('/works/:workId/episodes/:episodeId/plot-memo', validate('json', textSchema), (c) => {
  const { episode } = ownedEpisode(c);
  svc(c).repo.putPlotMemo(episode.id, c.req.valid('json').content);
  return c.json({ content: svc(c).repo.getPlotMemo(episode.id) });
})

.get('/works/:workId/episodes/:episodeId/summary', (c) => {
  const summary = svc(c).repo.getSummary(ownedEpisode(c).episode.id);
  return c.json(summary ?? { content: '', aiGenerated: false });
})

// 작가가 AI가 만든 요약을 고친다.
.put('/works/:workId/episodes/:episodeId/summary', validate('json', textSchema), (c) => {
  const { episode } = ownedEpisode(c);
  svc(c).repo.putSummary(episode.id, c.req.valid('json').content, false);
  return c.json(svc(c).repo.getSummary(episode.id));
})

// --- 회차 스냅샷 ---
.get('/works/:workId/episodes/:episodeId/snapshots', (c) => c.json(svc(c).repo.listSnapshots(ownedEpisode(c).episode.id)))

.post('/works/:workId/episodes/:episodeId/snapshots', (c) => c.json(svc(c).repo.createSnapshot(ownedEpisode(c).episode), 201))

.post('/works/:workId/episodes/:episodeId/snapshots/:snapshotId/restore', (c) => {
  const { work, episode } = ownedEpisode(c);
  const { repo } = svc(c);
  const snapshot = repo.getSnapshot(episode.id, c.req.param('snapshotId'));
  if (!snapshot) throw notFound();
  const body = { text: snapshot.bodyText, markdown: snapshot.bodyMarkdown, bodyJson: snapshot.bodyJson };
  return c.json(repo.updateEpisode(work.id, episode.id, { title: snapshot.title, body }));
})

// --- 고정 설정·고정 자료 ---
.get('/works/:workId/episodes/:episodeId/pinned-settings', (c) => c.json({ ids: svc(c).repo.getPinnedSettingIds(ownedEpisode(c).episode.id) }))

.put('/works/:workId/episodes/:episodeId/pinned-settings', validate('json', idsSchema), (c) => {
  const { work, episode } = ownedEpisode(c);
  const { repo } = svc(c);
  const { ids } = c.req.valid('json');
  if (ids.some((id) => !repo.getSetting(work.id, id))) throw unprocessable('이 작품의 설정만 고정할 수 있다');
  repo.setPinnedSettings(episode.id, ids);
  return c.json({ ids: repo.getPinnedSettingIds(episode.id) });
})

.get('/works/:workId/episodes/:episodeId/pinned-resources', (c) => c.json({ ids: svc(c).repo.getPinnedResourceIds(ownedEpisode(c).episode.id) }))

.put('/works/:workId/episodes/:episodeId/pinned-resources', validate('json', idsSchema), (c) => {
  const { work, episode } = ownedEpisode(c);
  const { repo } = svc(c);
  const { ids } = c.req.valid('json');
  if (ids.some((id) => !repo.getResource(work.id, id))) throw unprocessable('이 작품의 자료만 고정할 수 있다');
  repo.setPinnedResources(episode.id, ids);
  return c.json({ ids: repo.getPinnedResourceIds(episode.id) });
});
