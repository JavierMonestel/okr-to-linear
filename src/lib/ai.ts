import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { cyclesForMonth } from "./dates";
import { assignOwners, enforceDependencyOrder, planWithRules, snapEstimate } from "./planner";
import type { Plan, PlanRequest, PlannedIssue, TaskKind } from "./types";
import { KINDS, LINES } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const PlanSchema = z.object({
  projects: z.array(
    z.object({
      goalId: z.string(),
      name: z.string().describe("Short project name, usually the goal itself"),
      summary: z.string().describe("One sentence on the approach"),
      line: z.enum(LINES),
      successMetric: z.string().describe("Measurable outcome that proves the goal is met"),
    }),
  ),
  issues: z.array(
    z.object({
      id: z.string().describe("Stable id: <goalId>-<n>, e.g. g1-3"),
      goalId: z.string(),
      title: z.string().describe("Imperative, specific, under 90 characters"),
      description: z.string().describe("Markdown: context and a 'Done when:' acceptance criterion"),
      kind: z.enum(KINDS),
      estimate: z.number().int().describe("Story points: 1, 2, 3, 5 or 8"),
      assigneeId: z.string().nullable().describe("Team member id best suited by skill and remaining capacity"),
      cycle: z.number().int().describe("1-based cycle number within the month"),
      priority: z.number().int().describe("1 urgent, 2 high (critical path), 3 medium, 4 low"),
      blockedBy: z.array(z.string()).describe("Ids of issues that must finish first"),
    }),
  ),
});

function systemPrompt(req: PlanRequest): string {
  const cycles = cyclesForMonth(req.month);
  return `You are an AI chief of staff turning a startup's monthly goals into a Linear plan.
The company is an early-stage health-AI startup with a Clinical line (ECG-based software for health systems: evidence, regulatory, pilots) and a Performance line (athlete memberships: growth, devices, clubs).

Month: ${req.month}. Cycles: ${cycles.map((c) => `cycle ${c.number} = ${c.start} to ${c.end}`).join("; ")}.
Team (id · name · role · skills · capacity in points per cycle):
${req.team.map((m) => `- ${m.id} · ${m.name} · ${m.role} · ${m.skills.join("/")} · ${m.capacity}`).join("\n")}

Rules:
- One project per goal (use the goal id). 4 to 7 issues per goal that together achieve it; no filler.
- Each issue is a concrete deliverable sized 1-8 points (1, 2, 3, 5, 8). Split anything bigger.
- Model real dependencies with blockedBy (only ids within the plan). Never schedule an issue before its blockers.
- Assign owners by skill, and keep each person's points per cycle at or under their capacity where possible. If capacity is genuinely short, still produce the plan; the app will flag it.
- Priority 2 for the critical path of each goal, 3 for supporting work, 4 for small chores.
- Descriptions end with "Done when: <acceptance criterion>".
- Do not invent customers, numbers or people that are not in the goals or team.`;
}

export async function generatePlan(req: PlanRequest): Promise<Plan> {
  if (!aiEnabled()) return planWithRules(req);
  try {
    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 32000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(PlanSchema) },
      system: systemPrompt(req),
      messages: [{ role: "user", content: req.goals.map((g) => `${g.id} [${g.line}] ${g.text}`).join("\n") }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`no plan (stop_reason=${response.stop_reason})`);
    return normalize(response.parsed_output, req);
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.error(`[planner] Anthropic API error ${error.status}: ${error.message}`);
    else console.error("[planner]", error);
    return planWithRules(req);
  }
}

/** Never trust model output blindly: snap estimates, drop dangling ids, fix ordering, fill owners. */
function normalize(raw: z.infer<typeof PlanSchema>, req: PlanRequest): Plan {
  const cycles = cyclesForMonth(req.month);
  const goalIds = new Set(req.goals.map((g) => g.id));
  const teamIds = new Set(req.team.map((m) => m.id));
  const issuesRaw = raw.issues.filter((i) => goalIds.has(i.goalId));
  const ids = new Set(issuesRaw.map((i) => i.id));
  const issues: PlannedIssue[] = issuesRaw.map((i) => ({
    id: i.id,
    goalId: i.goalId,
    title: i.title.slice(0, 120),
    description: i.description,
    kind: (KINDS as readonly string[]).includes(i.kind) ? (i.kind as TaskKind) : "ops",
    estimate: snapEstimate(i.estimate),
    assigneeId: i.assigneeId && teamIds.has(i.assigneeId) ? i.assigneeId : null,
    cycle: Math.min(cycles.length, Math.max(1, i.cycle)),
    priority: Math.min(4, Math.max(1, i.priority)) as PlannedIssue["priority"],
    blockedBy: i.blockedBy.filter((b) => ids.has(b) && b !== i.id),
  }));
  const plan: Plan = {
    month: req.month,
    cycles,
    projects: raw.projects.filter((p) => goalIds.has(p.goalId)),
    issues: enforceDependencyOrder(issues),
    engine: "claude",
    generatedAt: new Date().toISOString(),
  };
  return assignOwners(plan, req.team, { keepExisting: true });
}
