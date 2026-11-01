import {
  adjustLength, checkSettings, continueWriting, draftEpisode, ghostText, polishStyle, researchTopic, rewriteSelection,
  type EngineDeps, type SuggestionStream,
} from '@muse-pen/story-engine';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { buildContextInput } from '../context';
import { type Ctx, type Env, HttpError, me, ownedEpisode, ownedWork, svc, validate } from '../http';

const aiBodySchema = z.strictObject({
  // 이어쓰기: 커서 앞 본문 / 다시쓰기·다듬기·늘리기·줄이기: 선택한 문장
  textBefore: z.string().optional(),
  selection: z.string().optional(),
  // 저장 전인 에디터 본문. 없으면 저장된 회차 본문을 쓴다.
  currentText: z.string().optional(),
});
type AiBody = z.infer<typeof aiBodySchema>;


// 호출 1회마다 AI 사용 기록 1건. 작가 ID와 추정 비용은 여기서 붙인다.
function engineDeps(c: Ctx): EngineDeps {
  const s = svc(c);
  const authorId = me(c).id;
  return { provider: s.textProvider, onUsage: (u) => s.recordUsage(authorId, u.feature, u.modelId, u.usage) };
}

function need(value: string | undefined, name: string): string {
  if (!value) throw new HttpError(400, `${name}이(가) 필요하다`);
  return value;
}

const STREAM_TASKS: Record<string, (deps: EngineDeps, input: ReturnType<typeof buildContextInput>, body: AiBody) => SuggestionStream> = {
  continue: (d, i, b) => continueWriting(d, i, need(b.textBefore, 'textBefore')),
  rewrite: (d, i, b) => rewriteSelection(d, i, need(b.selection, 'selection')),
  polish: (d, i, b) => polishStyle(d, i, need(b.selection, 'selection')),
  expand: (d, i, b) => adjustLength(d, i, need(b.selection, 'selection'), 'expand'),
  shrink: (d, i, b) => adjustLength(d, i, need(b.selection, 'selection'), 'shrink'),
  draft: (d, i) => draftEpisode(d, i),
};

const base = '/works/:workId/episodes/:episodeId/ai'

export const aiRoutes = new Hono<Env>()
// ghost text: 한 문장 이내 이어쓰기 제안(하위 모델). 수락은 작가가 Tab으로 한다.
.post(`${base}/ghost`, validate('json', aiBodySchema), async (c) => {
  const { work, episode } = ownedEpisode(c);
  const body = c.req.valid('json');
  const input = buildContextInput(svc(c).repo, work, episode, body.currentText);
  return c.json(await ghostText(engineDeps(c), input, need(body.textBefore, 'textBefore')));
})

// 설정 점검: 작가가 요청할 때만 LLM을 부른다.
.post(`${base}/setting-check`, validate('json', aiBodySchema), async (c) => {
  const { work, episode } = ownedEpisode(c);
  const input = buildContextInput(svc(c).repo, work, episode, c.req.valid('json').currentText);
  return c.json(await checkSettings(engineDeps(c), input));
})

// 대화형 텍스트: 요청 안에서 SSE로 흘려보낸다. 이벤트: token* → suggestion → done (실패 시 error).
// 결과는 AI 제안으로만 돌려주고 본문에는 반영하지 않는다. 수락은 작가가 회차 수정 요청으로 한다.
.post(`${base}/:task{continue|rewrite|polish|expand|shrink|draft}`, validate('json', aiBodySchema), (c) => {
  const { work, episode } = ownedEpisode(c);
  const body = c.req.valid('json');
  const input = buildContextInput(svc(c).repo, work, episode, body.currentText);
  const stream = STREAM_TASKS[c.req.param('task')]!(engineDeps(c), input, body);
  return streamSSE(c, async (sse) => {
    try {
      for await (const text of stream.tokens) await sse.writeSSE({ event: 'token', data: JSON.stringify({ text }) });
      await sse.writeSSE({ event: 'suggestion', data: JSON.stringify(await stream.result) });
      await sse.writeSSE({ event: 'done', data: '{}' });
    } catch (error) {
      await sse.writeSSE({ event: 'error', data: JSON.stringify({ message: error instanceof Error ? error.message : String(error) }) });
    }
  });
})

// 자료 조사: 결과는 미검증 초안이다. 저장은 작가가 자료 생성 요청으로 한다.
.post('/works/:workId/research', validate('json', z.strictObject({ question: z.string().min(1) })), async (c) => {
  ownedWork(c);
  const s = svc(c);
  const authorId = me(c).id;
  const result = await researchTopic(
    { search: s.searchProvider, onUsage: (u) => s.recordUsage(authorId, u.feature, u.modelId, u.usage) },
    { question: c.req.valid('json').question },
  );
  return c.json(result);
});
