import { z } from 'zod';

// Per-type known fields. `.passthrough()` keeps unknown keys so new XP
// metadata fields don't break the agent before this file is updated.
const schemas: Record<string, z.ZodTypeAny> = {
  TASK: z
    .object({
      dueDate: z.string().optional(),
      priority: z.string().optional(),
      estimatedHours: z.number().optional(),
    })
    .passthrough(),
  PERSON: z
    .object({
      email: z.string().optional(),
      phone: z.string().optional(),
      nextCatchupDate: z.string().optional(),
    })
    .passthrough(),
};

export function validateMetadata(
  type: string,
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (metadata === undefined) return undefined;
  const schema = schemas[type];
  if (!schema) return metadata; // no per-type rules → accept as-is
  return schema.parse(metadata) as Record<string, unknown>;
}
