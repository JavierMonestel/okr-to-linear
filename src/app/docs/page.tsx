import { headers } from "next/headers";

export const metadata = { title: "API · OKR → Linear Planner" };

export default async function DocsPage() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  const plan = `curl -X POST ${base}/api/plan \
  -H "Content-Type: application/json" \
  -d '{
    "month": "2026-10",
    "goals": [{ "id": "g1", "line": "clinical", "text": "Sign 2 health-system pilot LOIs" }],
    "team": [{ "id": "sam", "name": "Sam Rivera", "role": "CEO", "skills": ["partnerships"], "capacity": 8 }]
  }'`;
  const push = `curl -X POST ${base}/api/linear/push \
  -H "Content-Type: application/json" \
  -d '{ "plan": <plan from /api/plan>, "team": [...] }'`;
  return (
    <article className="mx-auto max-w-3xl space-y-6 text-sm leading-relaxed text-slate-700">
      <h1 className="text-2xl font-semibold text-slate-900">API</h1>
      <p>Both endpoints are plain JSON so the planner can run from a Zapier/Make/n8n schedule, for example on the first Monday of each month, reading the goals from Notion.</p>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">POST /api/plan</h2>
        <p>Goals + team in, plan out: projects, issues (estimate, owner, cycle, priority, blockers) and cycles. Uses Claude when <code>ANTHROPIC_API_KEY</code> is set, playbooks otherwise.</p>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-100">{plan}</pre>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">POST /api/linear/push</h2>
        <p>Creates the plan in Linear: <code>projectCreate</code> per goal, <code>issueCreate</code> per issue, <code>issueRelationCreate</code> (type <code>blocks</code>) per dependency. Workspace users and cycles are matched by name and date. Without <code>LINEAR_API_KEY</code> and <code>LINEAR_TEAM_ID</code> it returns the exact operations as a dry run.</p>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-100">{push}</pre>
      </section>
    </article>
  );
}
