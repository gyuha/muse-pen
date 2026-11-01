import { imageQualitySchema } from './images';
import { Hono } from 'hono';
import { z } from 'zod';
import { HttpError, type Env, me, notFound, ownedEpisode, ownedSetting, svc, validate, unprocessable } from '../http';

export const jobsRoutes = new Hono<Env>();

// 이미지 생성은 긴 작업이다. 작업 테이블에 등록하고 202로 바로 답한다.
jobsRoutes.post(
  '/works/:workId/settings/:settingId/images',
  validate('json', z.strictObject({ quality: imageQualitySchema.default('draft') })),
  (c) => {
    const { work, setting } = ownedSetting(c);
    if (setting.kind === 'world') throw unprocessable('세계관은 이미지를 만들지 않는다');
    const { repo, worker } = svc(c);
    const job = repo.createJob({ authorId: me(c).id, workId: work.id, kind: 'image_generation', targetId: setting.id, payload: { settingId: setting.id, quality: c.req.valid('json').quality } });
    worker.kick();
    return c.json(job, 202);
  },
);

// 회차 완료 처리(회차 요약 + 필드 변경 제안)도 긴 작업이다.
jobsRoutes.post('/works/:workId/episodes/:episodeId/complete', (c) => {
  const { work, episode } = ownedEpisode(c);
  const { repo, worker } = svc(c);
  repo.updateEpisode(work.id, episode.id, { completed: true });
  const job = repo.createJob({ authorId: me(c).id, workId: work.id, kind: 'episode_completion', targetId: episode.id, payload: { episodeId: episode.id } });
  worker.kick();
  return c.json(job, 202);
});

function ownedJob(c: Parameters<typeof me>[0]) {
  const job = svc(c).repo.getJob(c.req.param('jobId') ?? '');
  if (!job || job.authorId !== me(c).id) throw notFound();
  return job;
}

jobsRoutes.get('/jobs/:jobId', (c) => c.json(ownedJob(c)));

// 실패한 작업만 다시 요청할 수 있다.
jobsRoutes.post('/jobs/:jobId/retry', (c) => {
  const job = ownedJob(c);
  const { repo, worker } = svc(c);
  if (!repo.requeueJob(job.id)) throw new HttpError(409, '실패한 작업만 다시 요청할 수 있다');
  worker.kick();
  return c.json(repo.getJob(job.id));
});
