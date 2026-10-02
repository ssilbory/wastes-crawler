import { z } from 'zod';
import { recordBase } from './common.ts';

export const SkillSchema = z.strictObject({
  ...recordBase,
  description: z.string().min(1),
});
export type Skill = z.infer<typeof SkillSchema>;
