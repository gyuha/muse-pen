import { z } from 'zod';
import { idSchema, timestampSchema } from './common';

export const MAX_QUOTE_LENGTH = 150;

// 웹 페이지 원문을 담는 필드는 없다. 인용은 150자 이하만 저장한다.
export const sourceSchema = z.strictObject({
  url: z.url(),
  title: z.string().min(1),
  quote: z.string().max(MAX_QUOTE_LENGTH),
  retrievedAt: timestampSchema,
});
export type Source = z.infer<typeof sourceSchema>;

export const resourceSchema = z.strictObject({
  id: idSchema,
  workId: idSchema,
  title: z.string().min(1),
  question: z.string(),
  summary: z.string(),
  unverified: z.boolean(),
  sources: z.array(sourceSchema),
  tags: z.array(z.string().min(1)),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Resource = z.infer<typeof resourceSchema>;
