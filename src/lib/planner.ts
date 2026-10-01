import { cyclesForMonth } from "./dates";
import { objectOf, playbookFor } from "./playbooks";
import type { Estimate, Goal, LinearPriority, Plan, PlannedIssue, PlannedProject, PlanRequest, TeamMember } from "./types";
import { ESTIMATES } from "./types";

// ---------------------------------------------------------------- rules engine

export function planWithRules(req: PlanRequest, now = new Date()): Plan {
  const cycles = cyclesForMonth(req.month);
  const projects: PlannedProject[] = [];
  const issues: PlannedIssue[] = [];

  for (const goal of req.goals) {
    const playbook = playbookFor(goal.text);
    const object = objectOf(goal.text);
    const steps = playbook.steps.filter((s) => !s.lines || s.lines.includes(goal.line));
    projects.push({
      goalId: goal.id,
      name: goal.text,
      summary: `${playbook.label}: ${playbook.summary}`,
      line: goal.line,
      successMetric: /\d/.test(goal.text) ? goal.text : `Done when: ${steps.at(-1)?.done ?? goal.text}`,
    });
    // Re-index dependencies after filtering out steps that don't apply to this line.
    const kept = playbook.steps.map((s) => steps.includes(s));
    const newIndex = playbook.steps.map((_, i) => kept.slice(0, i).filter(Boolean).length);
    steps.forEach((step, i) => {
      const blockers = (step.after ?? []).filter((j) => kept[j]).map((j) => `${goal.id}-${newIndex[j] + 1}`);
      issues.push({
        id: `${goal.id}-${i + 1}`,
        goalId: goal.id,
        title: fill(step.title, object),
        description: describe(goal, step.done, playbook.label),
        kind: step.kind,
        estimate: step.estimate,
        assigneeId: null,
        cycle: 1,
        priority: 3,
        blockedBy: blockers,
      });
    });
  }

  const plan: Plan = { month: req.month, cycles, projects, issues, engine: "rules", generatedAt: now.toISOString() };
  return schedule(plan, req.team);
}

function fill(template: string, object: string): string {
  return template.replaceAll("{object}", object);
}

function describe(goal: Goal, done: string, playbook: string): string {
  return [`**Goal:** ${goal.text}`, "", `**Done when:** ${done}`, "", `_Generated from the monthly goals (${playbook} playbook)._`].join("\n");
}

// ---------------------------------------------------------------- scheduling

/** Longest chain of blockers above each issue (0 for issues nothing blocks). */
export function depths(issues: PlannedIssue[]): Map<string, number> {
  const byId = new Map(issues.map((i) => [i.id, i]));
  const memo = new Map<string, number>();
  const visit = (id: string, stack: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (stack.has(id)) return 0; // cycle guard; reported by analysis
    stack.add(id);
    const issue = byId.get(id);
    const d = issue && issue.blockedBy.length ? 1 + Math.max(...issue.blockedBy.filter((b) => byId.has(b)).map((b) => visit(b, stack)), -1) : 0;
    stack.delete(id);
    memo.set(id, Math.max(0, d));
    return memo.get(id)!;
  };
  for (const i of issues) visit(i.id, new Set());
  return memo;
}

/** Assign cycles from dependency depth, set priorities, then assign owners by skill and remaining capacity. */
export function schedule(plan: Plan, team: TeamMember[]): Plan {
  const n = plan.cycles.length;
  const depth = depths(plan.issues);
  const critical = criticalPath(plan.issues);

  const issues = plan.issues.map((issue) => {
    const goalIssues = plan.issues.filter((i) => i.goalId === issue.goalId);
    const maxDepth = Math.max(...goalIssues.map((i) => depth.get(i.id) ?? 0));
    const d = depth.get(issue.id) ?? 0;
    const cycle = Math.min(n, 1 + Math.floor((d * n) / (maxDepth + 1)));
    // Critical-path work is High; side work Medium; tiny chores Low.
    const priority: LinearPriority = critical.has(issue.id) ? 2 : issue.estimate <= 1 ? 4 : 3;
    return { ...issue, cycle, priority };
  });

  return assignOwners({ ...plan, issues: enforceDependencyOrder(issues) }, team);
}

/** Issues on the longest (by points) dependency chain of each goal. */
export function criticalPath(issues: PlannedIssue[]): Set<string> {
  const result = new Set<string>();
  for (const goalId of new Set(issues.map((i) => i.goalId))) {
    const goal = issues.filter((i) => i.goalId === goalId);
    const byId = new Map(goal.map((i) => [i.id, i]));
    const memo = new Map<string, { length: number; path: string[] }>();
    // Longest weighted chain ending at `id`.
    const longest = (id: string, seen = new Set<string>()): { length: number; path: string[] } => {
      if (memo.has(id)) return memo.get(id)!;
      const issue = byId.get(id)!;
      seen.add(id);
      let best = { length: 0, path: [] as string[] };
      for (const b of issue.blockedBy) {
        if (!byId.has(b) || seen.has(b)) continue;
        const candidate = longest(b, seen);
        if (candidate.length > best.length) best = candidate;
      }
      seen.delete(id);
      const result = { length: best.length + issue.estimate, path: [...best.path, id] };
      memo.set(id, result);
      return result;
    };
    const top = goal.map((i) => longest(i.id)).sort((a, b) => b.length - a.length)[0];
    top?.path.forEach((id) => result.add(id));
  }
  return result;
}

/** Make sure no issue is scheduled before something that blocks it. */
export function enforceDependencyOrder(issues: PlannedIssue[]): PlannedIssue[] {
  const byId = new Map(issues.map((i) => [i.id, { ...i }]));
  let changed = true;
  for (let guard = 0; changed && guard < 50; guard++) {
    changed = false;
    for (const issue of byId.values()) {
      const minCycle = Math.max(issue.cycle, ...issue.blockedBy.map((b) => byId.get(b)?.cycle ?? 1));
      if (minCycle > issue.cycle) {
        issue.cycle = minCycle;
        changed = true;
      }
    }
  }
  return issues.map((i) => byId.get(i.id)!);
}

export function assignOwners(plan: Plan, team: TeamMember[], { keepExisting = false } = {}): Plan {
  const load = new Map<string, number>(); // `${memberId}:${cycle}` -> points
  const key = (m: string, c: number) => `${m}:${c}`;
  const ordered = [...plan.issues].sort((a, b) => a.cycle - b.cycle || a.priority - b.priority || b.estimate - a.estimate);
  const assigned = new Map<string, string | null>();

  for (const issue of ordered) {
    if (keepExisting && issue.assigneeId && team.some((m) => m.id === issue.assigneeId)) {
      load.set(key(issue.assigneeId, issue.cycle), (load.get(key(issue.assigneeId, issue.cycle)) ?? 0) + issue.estimate);
      assigned.set(issue.id, issue.assigneeId);
      continue;
    }
    const skilled = team.filter((m) => m.skills.includes(issue.kind));
    const pool = skilled.length ? skilled : team;
    const ratio = (m: TeamMember) => ((load.get(key(m.id, issue.cycle)) ?? 0) + issue.estimate) / Math.max(1, m.capacity);
    const best = [...pool].sort((a, b) => ratio(a) - ratio(b))[0] ?? null;
    if (best) load.set(key(best.id, issue.cycle), (load.get(key(best.id, issue.cycle)) ?? 0) + issue.estimate);
    assigned.set(issue.id, best?.id ?? null);
  }
  return { ...plan, issues: plan.issues.map((i) => ({ ...i, assigneeId: assigned.get(i.id) ?? null })) };
}

export function snapEstimate(n: number): Estimate {
  return ESTIMATES.reduce((best, e) => (Math.abs(e - n) < Math.abs(best - n) ? e : best), ESTIMATES[0]);
}
