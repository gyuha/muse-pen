import { z } from 'zod';
import { idSchema, timestampSchema } from './common';

export const jobStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const jobKindSchema = z.enum(['image_generation', 'episode_completion']);
export type JobKind = z.infer<typeof jobKindSchema>;

export const jobSchema = z.strictObject({
  id: idSchema,
  authorId: idSchema,
  workId: idSchema,
  kind: jobKindSchema,
  status: jobStatusSchema,
  targetId: idSchema,
  // 완료 시 결과(이미지 생성: imageId, 회차 완료: 요약 등)
  result: z.unknown().nullable(),
  error: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Job = z.infer<typeof jobSchema>;
