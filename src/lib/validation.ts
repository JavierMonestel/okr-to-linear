import { z } from "zod";
import { ESTIMATES, KINDS, LINES, type Estimate } from "./types";

export const TeamMemberSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  role: z.string().max(80),
  skills: z.array(z.enum(KINDS)).max(KINDS.length),
  capacity: z.number().int().min(0).max(60),
});

export const PlanRequestSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  goals: z
    .array(z.object({ id: z.string().min(1).max(20), line: z.enum(LINES), text: z.string().trim().min(3).max(200) }))
    .min(1)
    .max(12),
  team: z.array(TeamMemberSchema).min(1).max(20),
});

export const PlanSchema = z.object({
  month: z.string(),
  cycles: z.array(z.object({ number: z.number().int(), start: z.string(), end: z.string() })).min(1),
  projects: z.array(
    z.object({ goalId: z.string(), name: z.string(), summary: z.string(), line: z.enum(LINES), successMetric: z.string() }),
  ),
  issues: z.array(
    z.object({
      id: z.string(),
      goalId: z.string(),
      title: z.string().min(1).max(200),
      description: z.string().max(5000),
      kind: z.enum(KINDS),
      estimate: z
        .number()
        .refine((n): n is Estimate => (ESTIMATES as readonly number[]).includes(n), "estimate must be 1, 2, 3, 5 or 8"),
      assigneeId: z.string().nullable(),
      cycle: z.number().int().min(1),
      priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      blockedBy: z.array(z.string()),
    }),
  ),
  engine: z.enum(["claude", "rules"]),
  generatedAt: z.string(),
});

export const PushRequestSchema = z.object({ plan: PlanSchema, team: z.array(TeamMemberSchema) });
