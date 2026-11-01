import { z } from 'zod';
import { blockJsonSchema, idSchema, timestampSchema } from './common';

// 본문 원본은 블록 JSON이고, 저장 때마다 일반 텍스트·Markdown 파생본을 함께 저장한다.
export const episodeSchema = z.strictObject({
  id: idSchema,
  workId: idSchema,
  order: z.number().int().positive(),
  title: z.string(),
  bodyJson: blockJsonSchema,
  bodyText: z.string(),
  bodyMarkdown: z.string(),
  completed: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Episode = z.infer<typeof episodeSchema>;
