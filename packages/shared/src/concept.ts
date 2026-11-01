import { z } from 'zod';
import { idSchema } from './common';

export const pointOfViewSchema = z.enum(['first_person', 'third_person']);
export type PointOfView = z.infer<typeof pointOfViewSchema>;

// 화풍 프리셋 = 그림체 문구 + 화풍 레퍼런스 이미지 최대 3장(이미지 ID).
// 작품 생성 시점에는 레퍼런스 이미지가 있을 수 없어 0장을 허용하고, 있으면 이미지 생성에 함께 넣는다.
export const artStylePresetSchema = z.strictObject({
  prompt: z.string().min(1),
  referenceImageIds: z.array(idSchema).max(3),
});
export type ArtStylePreset = z.infer<typeof artStylePresetSchema>;

export const conceptSchema = z.strictObject({
  genre: z.string().min(1),
  tone: z.string().min(1),
  pointOfView: pointOfViewSchema,
  targetReader: z.string().min(1),
  artStylePreset: artStylePresetSchema,
});
export type Concept = z.infer<typeof conceptSchema>;
