import { z } from 'zod';
import { idSchema, timestampSchema } from './common';

export const aiFeatureSchema = z.enum([
  'text_generation',
  'ghost_text',
  'setting_check',
  'episode_completion',
  'image_generation',
  'web_search',
]);
export type AiFeature = z.infer<typeof aiFeatureSchema>;

// 사용량: 텍스트는 토큰 수, 이미지는 장수, 검색은 횟수
export const aiUsageAmountSchema = z.discriminatedUnion('unit', [
  z.strictObject({
    unit: z.literal('tokens'),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  }),
  z.strictObject({ unit: z.literal('images'), count: z.number().int().nonnegative() }),
  z.strictObject({ unit: z.literal('searches'), count: z.number().int().nonnegative() }),
]);
export type AiUsageAmount = z.infer<typeof aiUsageAmountSchema>;

export const aiUsageRecordSchema = z.strictObject({
  id: idSchema,
  authorId: idSchema,
  feature: aiFeatureSchema,
  modelId: z.string().min(1),
  usage: aiUsageAmountSchema,
  estimatedCostUsd: z.number().nonnegative(),
  createdAt: timestampSchema,
});
export type AiUsageRecord = z.infer<typeof aiUsageRecordSchema>;
