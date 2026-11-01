import type { SearchProvider, SearchRequest, SearchResponse } from '../research';
import {
  estimateTokens,
  type TextProvider,
  type TextRequest,
  type TextResponse,
  type TextStreamEvent,
  type TokenUsage,
} from '../provider';

// 실제 SDK 연동(Claude 등)은 이 폴더에 파일을 추가해 TextProvider를 구현한다. 지금은 가짜만 있다.

const DEFAULT_TEXT = '가짜 공급자가 만든 첫 문장이다. 두 번째 문장이다.';
const DEFAULT_COMPLETION = JSON.stringify({ summary: '가짜 회차 요약', fieldChanges: [] });
const DEFAULT_CHECK = JSON.stringify({ issues: [] });

function defaultRespond(request: TextRequest): string {
  if (request.task === 'episode_completion') return DEFAULT_COMPLETION;
  if (request.task === 'setting_check') return DEFAULT_CHECK;
  return DEFAULT_TEXT;
}

// 결정적 가짜 공급자. 호출 횟수(calls)와 받은 요청(requests)을 기록해 테스트가 "0회 호출"을 단언할 수 있다.
export class FakeTextProvider implements TextProvider {
  calls = 0;
  readonly requests: TextRequest[] = [];

  constructor(private readonly respond: (request: TextRequest) => string = defaultRespond) {}

  private record(request: TextRequest): { text: string; usage: TokenUsage } {
    this.calls += 1;
    this.requests.push(request);
    const text = this.respond(request);
    return {
      text,
      usage: {
        modelId: request.model,
        inputTokens: estimateTokens(request.system + request.prompt),
        outputTokens: estimateTokens(text),
      },
    };
  }

  async generate(request: TextRequest): Promise<TextResponse> {
    return this.record(request);
  }

  async *stream(request: TextRequest): AsyncIterable<TextStreamEvent> {
    const { text, usage } = this.record(request);
    for (const token of text.match(/\S+\s*/g) ?? []) yield { type: 'token', text: token };
    yield { type: 'usage', usage };
  }
}

const DEFAULT_SEARCH: SearchResponse = {
  answer: '가짜 검색 답변이다.',
  sources: [
    {
      url: 'https://example.com/a',
      title: '가짜 출처 A',
      quote: '가짜 인용문 A',
      retrievedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  modelId: 'fake-search',
  searchCount: 1,
};

export class FakeSearchProvider implements SearchProvider {
  calls = 0;
  readonly requests: SearchRequest[] = [];

  constructor(private readonly response: SearchResponse = DEFAULT_SEARCH) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    this.calls += 1;
    this.requests.push(request);
    return this.response;
  }
}

