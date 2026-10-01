import type { Plan, TeamMember } from "./types";
import { LINE_LABEL } from "./types";

// Turns a plan into the ordered GraphQL operations that create it in Linear.
// IDs that only exist after an earlier call (or that must be looked up in the
// workspace) are written as placeholders: {{project:g1}}, {{issue:g1-2}},
// {{user:dev}}, {{cycle:1}}. The push route resolves them as it goes.

export const LINEAR_ENDPOINT = "https://api.linear.app/graphql";

export const MUTATIONS = {
  projectCreate: `mutation ProjectCreate($input: ProjectCreateInput!) {
  projectCreate(input: $input) { success project { id name url } }
}`,
  issueCreate: `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) { success issue { id identifier url } }
}`,
  issueRelationCreate: `mutation IssueRelationCreate($input: IssueRelationCreateInput!) {
  issueRelationCreate(input: $input) { success }
}`,
} as const;

export type OperationKind = keyof typeof MUTATIONS;

export interface LinearOperation {
  kind: OperationKind;
  ref: string; // what this op creates, e.g. "project:g1" or "issue:g1-2"
  label: string;
  query: string;
  variables: { input: Record<string, unknown> };
}

export function buildOperations(plan: Plan, teamId = "{{team}}"): LinearOperation[] {
  const ops: LinearOperation[] = [];
  const lastCycle = plan.cycles.at(-1);

  for (const p of plan.projects) {
    ops.push({
      kind: "projectCreate",
      ref: `project:${p.goalId}`,
      label: `Project · ${p.name}`,
      query: MUTATIONS.projectCreate,
      variables: {
        input: {
          name: p.name,
          description: `${p.summary}\n\nSuccess metric: ${p.successMetric}\nBusiness line: ${LINE_LABEL[p.line]}`,
          teamIds: [teamId],
          ...(lastCycle ? { targetDate: lastCycle.end } : {}),
        },
      },
    });
  }

  for (const i of plan.issues) {
    const cycle = plan.cycles.find((c) => c.number === i.cycle);
    ops.push({
      kind: "issueCreate",
      ref: `issue:${i.id}`,
      label: `Issue · ${i.title}`,
      query: MUTATIONS.issueCreate,
      variables: {
        input: {
          teamId,
          title: i.title,
          description: i.description,
          projectId: `{{project:${i.goalId}}}`,
          estimate: i.estimate,
          priority: i.priority,
          ...(i.assigneeId ? { assigneeId: `{{user:${i.assigneeId}}}` } : {}),
          cycleId: `{{cycle:${i.cycle}}}`,
          ...(cycle ? { dueDate: cycle.end } : {}),
        },
      },
    });
  }

  for (const i of plan.issues) {
    for (const blocker of i.blockedBy) {
      ops.push({
        kind: "issueRelationCreate",
        ref: `relation:${blocker}->${i.id}`,
        label: `Dependency · ${blocker} blocks ${i.id}`,
        query: MUTATIONS.issueRelationCreate,
        variables: { input: { issueId: `{{issue:${blocker}}}`, relatedIssueId: `{{issue:${i.id}}}`, type: "blocks" } },
      });
    }
  }
  return ops;
}

/** Replace {{placeholders}} anywhere inside a JSON-like value. Unresolved optional ids are dropped. */
export function resolvePlaceholders<T>(value: T, ids: Map<string, string>): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const m = v.match(/^\{\{(.+)\}\}$/);
      if (m) return ids.get(m[1]);
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) {
        const resolved = walk(val);
        if (resolved !== undefined) out[k] = resolved;
      }
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

/** CSV in a shape that maps cleanly onto Linear's importer (and any spreadsheet). */
export function toCsv(plan: Plan, team: TeamMember[]): string {
  const name = (id: string | null) => team.find((m) => m.id === id)?.name ?? "";
  const project = (goalId: string) => plan.projects.find((p) => p.goalId === goalId)?.name ?? "";
  const rows = [["ID", "Title", "Description", "Project", "Assignee", "Estimate", "Priority", "Cycle", "Due Date", "Labels", "Blocked By"]];
  for (const i of plan.issues) {
    const cycle = plan.cycles.find((c) => c.number === i.cycle);
    const line = plan.projects.find((p) => p.goalId === i.goalId)?.line;
    rows.push([
      i.id,
      i.title,
      i.description.replace(/\n+/g, " "),
      project(i.goalId),
      name(i.assigneeId),
      String(i.estimate),
      ["", "Urgent", "High", "Medium", "Low"][i.priority],
      `Cycle ${i.cycle}`,
      cycle?.end ?? "",
      [line ? LINE_LABEL[line] : "", i.kind].filter(Boolean).join(", "),
      i.blockedBy.join(" "),
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}
