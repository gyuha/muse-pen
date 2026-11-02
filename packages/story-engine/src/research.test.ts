import { describe, expect, it } from 'vitest';
import { FakeSearchProvider } from './providers/fake';
import { researchTopic } from './research';
import type { UsageReport } from './provider';

const src = (url: string, quote = '인용') => ({ url, title: 't', quote, retrievedAt: '2026-01-01T00:00:00.000Z' });

describe('researchTopic', () => {
  it('인용을 150자 이하로 줄이고 네이버 블로그·뉴스·지식백과 출처를 제외한다', async () => {
    const search = new FakeSearchProvider({
      answer: '답',
      modelId: 'fake-search',
      searchCount: 2,
      sources: [
        src('https://example.com/a', 'x'.repeat(400)),
        src('https://blog.naver.com/u/1'),
        src('https://m.blog.naver.com/u/1'),
        src('https://n.news.naver.com/a'),
        src('https://terms.naver.com/e'),
        src('https://namu.wiki/w/x'),
      ],
    });
    const reports: UsageReport[] = [];
    const result = await researchTopic({ search, onUsage: (r) => reports.push(r) }, { question: '관직' });
    expect(result.sources.map((s) => s.url)).toEqual(['https://example.com/a', 'https://namu.wiki/w/x']);
    expect(result.sources[0]?.quote).toHaveLength(150);
    expect(result.unverified).toBe(true);
    expect(search.calls).toBe(1);
    expect(reports).toEqual([{ feature: 'web_search', modelId: 'fake-search', usage: { unit: 'searches', count: 2 } }]);
  });
});
