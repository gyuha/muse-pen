import type { Concept, Resource, Setting } from '@muse-pen/shared';
import type { ContextInput } from './types';

const T = '2026-01-01T00:00:00.000Z';
const body = { bodyJson: null, bodyMarkdown: '', createdAt: T, updatedAt: T, workId: 'w1' };

export const concept: Concept = {
  genre: '무협',
  tone: '건조하고 냉소적',
  pointOfView: 'third_person',
  targetReader: '20~30대 남성',
  artStylePreset: { prompt: '수묵화', referenceImageIds: ['img1'] },
};

export function character(id: string, name: string, over: Partial<Extract<Setting, { kind: 'character' }>> = {}): Setting {
  return {
    kind: 'character', id, name, aliases: [], gender: '남', ageGroup: '20대', appearanceKeywords: ['흑발'],
    status: 'alive', representativeImageId: null, bodyText: `${name} 본문`, ...body, ...over,
  };
}

export function location(id: string, name: string): Setting {
  return { kind: 'location', id, name, placeType: '객잔', eraMoodKeywords: [], representativeImageId: null, bodyText: `${name} 본문`, ...body };
}

export function resource(id: string, title: string, over: Partial<Resource> = {}): Resource {
  return {
    id, workId: 'w1', title, question: '질문', summary: `${title} 요약`, unverified: false, tags: [],
    sources: [{ url: 'https://example.com/x', title: 't', quote: '비밀 인용문', retrievedAt: T }],
    createdAt: T, updatedAt: T, ...over,
  };
}

export function baseInput(over: Partial<ContextInput> = {}): ContextInput {
  return {
    concept,
    synopsis: '복수극 시놉시스',
    settings: [],
    pinnedSettingIds: [],
    resources: [],
    pinnedResourceIds: [],
    episodes: [],
    currentEpisode: { id: 'e5', order: 5, title: '다섯째', bodyText: '', plotMemo: '' },
    ...over,
  };
}
