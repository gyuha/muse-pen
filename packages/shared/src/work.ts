import { z } from 'zod';
import { idSchema, timestampSchema } from './common';
import { conceptSchema } from './concept';

export const workSchema = z.strictObject({
  id: idSchema,
  authorId: idSchema,
  title: z.string().min(1),
  concept: conceptSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Work = z.infer<typeof workSchema>;

export const createWorkInputSchema = z.strictObject({
  title: z.string().min(1),
  concept: conceptSchema,
});
export type CreateWorkInput = z.infer<typeof createWorkInputSchema>;
