import { MAX_QUOTE_LENGTH, type Source } from '@muse-pen/shared';
import type { UsageReporter } from './provider';

export interface SearchRequest {
  question: string;
  // web_search 도구의 max_uses에 해당.
  maxUses?: number;
}

export interface SearchResponse {
  answer: string;
  sources: Source[];
  modelId: string;
  searchCount: number;
}

// 검색 백엔드(Claude web_search → 나중에 Tavily 교체 가능) 인터페이스.
export interface SearchProvider {
  search(request: SearchRequest): Promise<SearchResponse>;
}

// robots.txt가 RAG 봇을 막은 출처는 근거로 쓰지 않는다(docs/07).
const BLOCKED_HOSTS = ['blog.naver.com', 'news.naver.com', 'terms.naver.com'];

function isBlocked(url: string): boolean {
  const host = /^[a-z][a-z0-9+.-]*:\/\/([^/:?#]+)/i.exec(url)?.[1]?.toLowerCase() ?? '';
  return BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

function clampQuote(quote: string): string {
  return quote.length <= MAX_QUOTE_LENGTH ? quote : `${quote.slice(0, MAX_QUOTE_LENGTH - 1)}…`;
}

export interface ResearchResult {
  answer: string;
  sources: Source[];
  // AI 초안이므로 작가가 확인하기 전까지 미검증.
  unverified: true;
}

export async function researchTopic(
  deps: { search: SearchProvider; onUsage?: UsageReporter },
  request: SearchRequest,
): Promise<ResearchResult> {
  const response = await deps.search.search(request);
  deps.onUsage?.({
    feature: 'web_search',
    modelId: response.modelId,
    usage: { unit: 'searches', count: response.searchCount },
  });
  return {
    answer: response.answer,
    sources: response.sources
      .filter((source) => !isBlocked(source.url))
      .map((source) => ({ ...source, quote: clampQuote(source.quote) })),
    unverified: true,
  };
}
