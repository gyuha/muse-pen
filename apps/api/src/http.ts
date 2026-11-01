import { zValidator } from '@hono/zod-validator';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ZodType } from 'zod';
import type { Services } from './services';

export interface AuthorInfo {
  id: string;
  email: string;
  role: string;
}
export type Env = { Variables: { author: AuthorInfo; services: Services } };
export type Ctx = Context<Env>;

export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
  ) {
    super(message);
  }
}

// 남의 자원과 없는 자원은 구분하지 않고 모두 404로 답한다(존재 여부를 흘리지 않는다).
export const notFound = () => new HttpError(404, 'not found');
// 스키마는 맞지만 의미가 틀린 입력(다른 작품의 캐릭터를 소품 소유자로 지정 등)
export const unprocessable = (message: string) => new HttpError(422, message);

export const validate = <T extends ZodType>(target: 'json' | 'query', schema: T) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) return c.json({ error: 'validation', issues: result.error.issues }, 400);
  });

export const svc = (c: Ctx): Services => c.get('services');
export const me = (c: Ctx): AuthorInfo => c.get('author');

export function ownedWork(c: Ctx) {
  const work = svc(c).repo.getOwnedWork(me(c).id, c.req.param('workId') ?? '');
  if (!work) throw notFound();
  return work;
}

export function ownedEpisode(c: Ctx) {
  const work = ownedWork(c);
  const episode = svc(c).repo.getEpisode(work.id, c.req.param('episodeId') ?? '');
  if (!episode) throw notFound();
  return { work, episode };
}

export function ownedSetting(c: Ctx) {
  const work = ownedWork(c);
  const setting = svc(c).repo.getSetting(work.id, c.req.param('settingId') ?? '');
  if (!setting) throw notFound();
  return { work, setting };
}
