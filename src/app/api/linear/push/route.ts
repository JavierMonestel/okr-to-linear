import { buildOperations, LINEAR_ENDPOINT, resolvePlaceholders, type LinearOperation } from "@/lib/linear";
import type { Plan, TeamMember } from "@/lib/types";
import { PushRequestSchema } from "@/lib/validation";

// POST { plan, team } -> creates projects, issues and dependencies in Linear.
// Without LINEAR_API_KEY + LINEAR_TEAM_ID it is a dry run that returns the exact
// operations it would execute, in order.

export const maxDuration = 60;

interface OpResult {
  ref: string;
  label: string;
  status: "created" | "dry_run" | "error" | "skipped";
  url?: string;
  identifier?: string;
  error?: string;
}

export async function POST(request: Request) {
  const parsed = PushRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid plan" }, { status: 400 });
  const { plan, team } = parsed.data as { plan: Plan; team: TeamMember[] };

  const apiKey = process.env.LINEAR_API_KEY;
  const teamId = process.env.LINEAR_TEAM_ID;
  if (!apiKey || !teamId) {
    const operations = buildOperations(plan);
    return Response.json({
      mode: "dry_run",
      note: "Set LINEAR_API_KEY and LINEAR_TEAM_ID to create these in a real workspace.",
      operations,
      results: operations.map<OpResult>((op) => ({ ref: op.ref, label: op.label, status: "dry_run" })),
    });
  }

  const gql = async (query: string, variables: Record<string, unknown>) => {
    const res = await fetch(LINEAR_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: apiKey },
      body: JSON.stringify({ query, variables }),
    });
    return (await res.json()) as { data?: Record<string, unknown>; errors?: { message: string }[] };
  };

  // Look up workspace users and cycles so {{user:*}} and {{cycle:*}} resolve to real ids.
  const ids = new Map<string, string>([["team", teamId]]);
  const lookup = await gql(
    `query Lookup($teamId: String!) {
      team(id: $teamId) {
        members { nodes { id name displayName } }
        cycles(first: 20) { nodes { id number startsAt endsAt } }
      }
    }`,
    { teamId },
  );
  const teamData = (lookup.data?.team ?? {}) as {
    members?: { nodes: { id: string; name: string; displayName: string }[] };
    cycles?: { nodes: { id: string; startsAt: string; endsAt: string }[] };
  };
  for (const member of team) {
    const match = teamData.members?.nodes.find(
      (u) => u.name.toLowerCase() === member.name.toLowerCase() || u.displayName.toLowerCase() === member.name.split(" ")[0].toLowerCase(),
    );
    if (match) ids.set(`user:${member.id}`, match.id);
  }
  for (const cycle of plan.cycles) {
    const match = teamData.cycles?.nodes.find((c) => c.startsAt.slice(0, 10) <= cycle.end && c.endsAt.slice(0, 10) >= cycle.start);
    if (match) ids.set(`cycle:${cycle.number}`, match.id);
  }

  const results: OpResult[] = [];
  for (const op of buildOperations(plan, teamId)) {
    results.push(await execute(op, ids, gql));
  }
  return Response.json({ mode: "live", results });
}

async function execute(
  op: LinearOperation,
  ids: Map<string, string>,
  gql: (q: string, v: Record<string, unknown>) => Promise<{ data?: Record<string, unknown>; errors?: { message: string }[] }>,
): Promise<OpResult> {
  const variables = resolvePlaceholders(op.variables, ids);
  if (op.kind === "issueRelationCreate" && (!variables.input.issueId || !variables.input.relatedIssueId)) {
    return { ref: op.ref, label: op.label, status: "skipped", error: "an issue in this relation was not created" };
  }
  try {
    const res = await gql(op.query, variables);
    if (res.errors?.length) return { ref: op.ref, label: op.label, status: "error", error: res.errors[0].message };
    const payload = res.data?.[op.kind] as
      | { success: boolean; project?: { id: string; url: string }; issue?: { id: string; identifier: string; url: string } }
      | undefined;
    if (!payload?.success) return { ref: op.ref, label: op.label, status: "error", error: "Linear returned success=false" };
    const created = payload.project ?? payload.issue;
    if (created) ids.set(op.ref, created.id);
    return { ref: op.ref, label: op.label, status: "created", url: created?.url, identifier: payload.issue?.identifier };
  } catch (error) {
    return { ref: op.ref, label: op.label, status: "error", error: String(error).slice(0, 200) };
  }
}
