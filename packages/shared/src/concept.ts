import { z } from 'zod';
import { idSchema } from './common';

export const pointOfViewSchema = z.enum(['first_person', 'third_person']);
export type PointOfView = z.infer<typeof pointOfViewSchema>;

// 화풍 프리셋 = 그림체 문구 + 화풍 레퍼런스 이미지 1~3장(이미지 ID)
export const artStylePresetSchema = z.strictObject({
  prompt: z.string().min(1),
  referenceImageIds: z.array(idSchema).min(1).max(3),
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
