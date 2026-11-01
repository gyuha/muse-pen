import { z } from 'zod';
import { blockJsonSchema, idSchema, timestampSchema } from './common';

export const settingKindSchema = z.enum(['character', 'location', 'prop', 'world']);
export type SettingKind = z.infer<typeof settingKindSchema>;

export const characterStatusSchema = z.enum(['alive', 'dead', 'missing']);
export type CharacterStatus = z.infer<typeof characterStatusSchema>;

const keywords = z.array(z.string().min(1));
const representativeImageId = idSchema.nullable();

// 종류별 정형 필드는 고정이다. strictObject라서 정의되지 않은 필드는 거부된다.
export const characterFieldsSchema = z.strictObject({
  kind: z.literal('character'),
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  gender: z.string(),
  ageGroup: z.string(),
  appearanceKeywords: keywords,
  status: characterStatusSchema,
  representativeImageId,
});

export const locationFieldsSchema = z.strictObject({
  kind: z.literal('location'),
  name: z.string().min(1),
  placeType: z.string(),
  eraMoodKeywords: keywords,
  representativeImageId,
});

export const propFieldsSchema = z.strictObject({
  kind: z.literal('prop'),
  name: z.string().min(1),
  ownerCharacterId: idSchema.nullable(),
  appearanceKeywords: keywords,
  representativeImageId,
});

export const worldFieldsSchema = z.strictObject({
  kind: z.literal('world'),
  name: z.string().min(1),
  rulesSummary: z.string(),
});

export const settingFieldsSchema = z.discriminatedUnion('kind', [
  characterFieldsSchema,
  locationFieldsSchema,
  propFieldsSchema,
  worldFieldsSchema,
]);
export type SettingFields = z.infer<typeof settingFieldsSchema>;

// 설정 = 정형 필드 + 설정 본문(블록 JSON과 파생 텍스트·Markdown)
const bodyShape = {
  id: idSchema,
  workId: idSchema,
  bodyJson: blockJsonSchema,
  bodyText: z.string(),
  bodyMarkdown: z.string(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
};

export const settingSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...characterFieldsSchema.shape, ...bodyShape }),
  z.strictObject({ ...locationFieldsSchema.shape, ...bodyShape }),
  z.strictObject({ ...propFieldsSchema.shape, ...bodyShape }),
  z.strictObject({ ...worldFieldsSchema.shape, ...bodyShape }),
]);
export type Setting = z.infer<typeof settingSchema>;
