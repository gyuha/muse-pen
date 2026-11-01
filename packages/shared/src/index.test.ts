import { describe, expect, it } from 'vitest';
import {
  aiUsageRecordSchema,
  characterFieldsSchema,
  conceptSchema,
  imageRecordSchema,
  jobStatusSchema,
  locationFieldsSchema,
  propFieldsSchema,
  resourceSchema,
  settingFieldsSchema,
  sourceSchema,
  worldFieldsSchema,
} from './index';

const now = '2026-11-02T00:00:00.000Z';

const character = {
  kind: 'character',
  name: '하린',
  aliases: ['린'],
  gender: '여',
  ageGroup: '10대 후반',
  appearanceKeywords: ['흑발', '검은 눈'],
  status: 'alive',
  representativeImageId: null,
} as const;

describe('설정 4종 정형 필드', () => {
  it('캐릭터: 정의된 필드만 받는다', () => {
    expect(characterFieldsSchema.safeParse(character).success).toBe(true);
    expect(characterFieldsSchema.safeParse({ ...character, nickname: 'x' }).success).toBe(false);
  });

  it('캐릭터 상태는 생존·사망·행방불명 3값만 허용한다', () => {
    for (const status of ['alive', 'dead', 'missing']) {
      expect(characterFieldsSchema.safeParse({ ...character, status }).success).toBe(true);
    }
    expect(characterFieldsSchema.safeParse({ ...character, status: 'unknown' }).success).toBe(false);
  });

  it('장소: 정의되지 않은 필드를 거부한다', () => {
    const location = { kind: 'location', name: '왕궁', placeType: '성', eraMoodKeywords: ['중세'], representativeImageId: null };
    expect(locationFieldsSchema.safeParse(location).success).toBe(true);
    expect(locationFieldsSchema.safeParse({ ...location, ruler: 'x' }).success).toBe(false);
  });

  it('소품: 소유자는 캐릭터 ID 참조이고 비워 둘 수 있다', () => {
    const prop = { kind: 'prop', name: '검', ownerCharacterId: 'c1', appearanceKeywords: ['은빛'], representativeImageId: null };
    expect(propFieldsSchema.safeParse(prop).success).toBe(true);
    expect(propFieldsSchema.safeParse({ ...prop, ownerCharacterId: null }).success).toBe(true);
    expect(propFieldsSchema.safeParse({ ...prop, weight: 3 }).success).toBe(false);
  });

  it('세계관: 이미지 필드가 없다', () => {
    const world = { kind: 'world', name: '마법 체계', rulesSummary: '마력은 유한하다' };
    expect(worldFieldsSchema.safeParse(world).success).toBe(true);
    expect(worldFieldsSchema.safeParse({ ...world, representativeImageId: null }).success).toBe(false);
  });

  it('kind로 종류를 구분하고 모르는 kind는 거부한다', () => {
    expect(settingFieldsSchema.safeParse(character).success).toBe(true);
    expect(settingFieldsSchema.safeParse({ ...character, kind: 'item' }).success).toBe(false);
  });
});

describe('컨셉', () => {
  const concept = {
    genre: '판타지',
    tone: '진지',
    pointOfView: 'third_person',
    targetReader: '20대',
    artStylePreset: { prompt: '수채화풍', referenceImageIds: ['i1'] },
  };

  it('5항목을 받는다', () => {
    expect(conceptSchema.safeParse(concept).success).toBe(true);
  });

  it('화풍 레퍼런스 이미지는 1~3장이다', () => {
    const withRefs = (ids: string[]) => ({ ...concept, artStylePreset: { prompt: '수채화풍', referenceImageIds: ids } });
    expect(conceptSchema.safeParse(withRefs([])).success).toBe(false);
    expect(conceptSchema.safeParse(withRefs(['a', 'b', 'c'])).success).toBe(true);
    expect(conceptSchema.safeParse(withRefs(['a', 'b', 'c', 'd'])).success).toBe(false);
  });

  it('서술 시점은 1인칭·3인칭만 허용한다', () => {
    expect(conceptSchema.safeParse({ ...concept, pointOfView: 'second_person' }).success).toBe(false);
  });
});

describe('자료·출처', () => {
  const source = { url: 'https://example.com/a', title: '문서', quote: '가'.repeat(150), retrievedAt: now };

  it('인용은 150자 이하만 허용한다', () => {
    expect(sourceSchema.safeParse(source).success).toBe(true);
    expect(sourceSchema.safeParse({ ...source, quote: '가'.repeat(151) }).success).toBe(false);
  });

  it('웹 원문 필드는 거부한다', () => {
    expect(sourceSchema.safeParse({ ...source, rawHtml: '<p>x</p>' }).success).toBe(false);
    const resource = {
      id: 'r1', workId: 'w1', title: 't', question: 'q', summary: 's', unverified: true,
      sources: [source], tags: [], createdAt: now, updatedAt: now,
    };
    expect(resourceSchema.safeParse(resource).success).toBe(true);
    expect(resourceSchema.safeParse({ ...resource, content: '원문' }).success).toBe(false);
  });
});

describe('이미지·작업·AI 사용 기록', () => {
  const image = {
    id: 'i1', workId: 'w1', targetType: 'setting', targetId: 's1',
    storageKey: 'w1/i1.png', isRepresentative: false, modelId: 'fake-image-1', createdAt: now,
  };

  it('이미지 기록은 모델 ID가 필수다', () => {
    expect(imageRecordSchema.safeParse(image).success).toBe(true);
    const { modelId: _omit, ...noModel } = image;
    expect(imageRecordSchema.safeParse(noModel).success).toBe(false);
    expect(imageRecordSchema.safeParse({ ...image, modelId: '' }).success).toBe(false);
  });

  it('작업 상태는 대기·실행중·완료·실패 4값이다', () => {
    for (const s of ['pending', 'running', 'completed', 'failed']) {
      expect(jobStatusSchema.safeParse(s).success).toBe(true);
    }
    expect(jobStatusSchema.safeParse('cancelled').success).toBe(false);
  });

  it('AI 사용 기록은 단위별 사용량을 구분한다', () => {
    const base = { id: 'u1', authorId: 'a1', feature: 'text_generation', modelId: 'fake-text-1', estimatedCostUsd: 0.01, createdAt: now };
    expect(aiUsageRecordSchema.safeParse({ ...base, usage: { unit: 'tokens', inputTokens: 10, outputTokens: 5 } }).success).toBe(true);
    expect(aiUsageRecordSchema.safeParse({ ...base, feature: 'image_generation', usage: { unit: 'images', count: 1 } }).success).toBe(true);
    expect(aiUsageRecordSchema.safeParse({ ...base, usage: { unit: 'tokens', count: 1 } }).success).toBe(false);
  });
});
