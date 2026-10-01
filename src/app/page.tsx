import { connection } from "next/server";
import { aiEnabled } from "@/lib/ai";
import { currentMonth } from "@/lib/dates";
import { DEFAULT_TEAM, GOAL_TEMPLATES, makeGoals } from "@/lib/defaults";
import { planWithRules } from "@/lib/planner";
import { PlannerGate } from "@/components/Planner";

export default async function Home() {
  await connection(); // read the env and today's date at request time, not build time
  // Instant, free starting point; "Generate" re-plans with Claude when a key is configured.
  const initialPlan = planWithRules({ month: currentMonth(), goals: makeGoals(GOAL_TEMPLATES[0].goals), team: DEFAULT_TEAM });
  return <PlannerGate aiOn={aiEnabled()} initialPlan={initialPlan} />;
}
