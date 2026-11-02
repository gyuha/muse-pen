import { z } from 'zod';
import { idSchema, timestampSchema } from './common';

export const imageTargetTypeSchema = z.enum(['setting', 'art_style']);
export type ImageTargetType = z.infer<typeof imageTargetTypeSchema>;

// 모델 ID는 필수다. 공급자가 모델을 은퇴시키면 영향받는 이미지를 찾는 데 쓴다.
export const imageRecordSchema = z.strictObject({
  id: idSchema,
  workId: idSchema,
  targetType: imageTargetTypeSchema,
  targetId: idSchema,
  storageKey: z.string().min(1),
  isRepresentative: z.boolean(),
  modelId: z.string().min(1),
  createdAt: timestampSchema,
});
export type ImageRecord = z.infer<typeof imageRecordSchema>;
