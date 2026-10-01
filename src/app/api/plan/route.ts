import { generatePlan } from "@/lib/ai";
import { PlanRequestSchema } from "@/lib/validation";

// POST { month, goals[], team[] } -> Plan (projects, issues, cycles)
export async function POST(request: Request) {
  const parsed = PlanRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid request", detail: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const plan = await generatePlan(parsed.data);
  return Response.json(plan);
}
