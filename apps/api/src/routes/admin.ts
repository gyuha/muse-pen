import { Hono } from 'hono';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { type Env, HttpError, me, notFound, svc, validate } from '../http';

export const newInviteCode = (): string => randomBytes(9).toString('base64url')

export const adminRoutes = new Hono<Env>()

// 관리자 전용. 일반 작가는 403이다(자원 소유권이 아니라 역할 문제이므로 404로 숨기지 않는다).
.use('/admin/*', async (c, next) => {
  if (me(c).role !== 'admin') throw new HttpError(403, 'forbidden');
  await next();
})

.post('/admin/invites', validate('json', z.strictObject({ code: z.string().min(4).optional() })), (c) => {
  try {
    return c.json(svc(c).repo.createInvite(c.req.valid('json').code ?? newInviteCode()), 201);
  } catch {
    throw new HttpError(409, '이미 있는 초대 코드다');
  }
})

.get('/admin/invites', (c) => c.json(svc(c).repo.listInvites()))

.get('/admin/authors', (c) => c.json(svc(c).repo.listAuthors()))

// 비밀번호 재설정은 관리자가 한다(메일 발송 없음). 기존 세션은 모두 끊는다.
.post('/admin/authors/:authorId/password', validate('json', z.strictObject({ newPassword: z.string().min(8) })), async (c) => {
  const { repo, auth } = svc(c);
  const author = repo.getAuthor(c.req.param('authorId'));
  if (!author) throw notFound();
  const headers = c.req.raw.headers;
  await auth.api.setUserPassword({ body: { userId: author.id, newPassword: c.req.valid('json').newPassword }, headers });
  await auth.api.revokeUserSessions({ body: { userId: author.id }, headers });
  return c.body(null, 204);
})

// 운영자가 AI 사용 기록을 본다.
.get('/admin/usage', validate('query', z.object({ authorId: z.string().optional() })), (c) =>
  c.json(svc(c).repo.listUsage(c.req.valid('query').authorId)),
);
