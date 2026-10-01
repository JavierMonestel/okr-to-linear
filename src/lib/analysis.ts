import type { Plan, PlannedIssue, TeamMember } from "./types";
import { enforceDependencyOrder } from "./planner";

export interface LoadCell {
  memberId: string;
  cycle: number;
  points: number;
  capacity: number;
  issues: PlannedIssue[];
}

export function capacityTable(plan: Plan, team: TeamMember[]): LoadCell[] {
  const cells: LoadCell[] = [];
  for (const m of team) {
    for (const c of plan.cycles) {
      const issues = plan.issues.filter((i) => i.assigneeId === m.id && i.cycle === c.number);
      cells.push({ memberId: m.id, cycle: c.number, points: issues.reduce((s, i) => s + i.estimate, 0), capacity: m.capacity, issues });
    }
  }
  return cells;
}

export type WarningKind = "over-capacity" | "dependency" | "unassigned" | "skill-mismatch" | "circular";

export interface PlanWarning {
  kind: WarningKind;
  message: string;
  issueIds: string[];
}

export function analyzePlan(plan: Plan, team: TeamMember[]): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const byId = new Map(plan.issues.map((i) => [i.id, i]));
  const names = new Map(team.map((m) => [m.id, m.name.split(" ")[0]]));

  for (const cell of capacityTable(plan, team)) {
    if (cell.points > cell.capacity) {
      warnings.push({
        kind: "over-capacity",
        message: `${names.get(cell.memberId)} is at ${cell.points}/${cell.capacity} pts in cycle ${cell.cycle}`,
        issueIds: cell.issues.map((i) => i.id),
      });
    }
  }
  for (const issue of plan.issues) {
    for (const b of issue.blockedBy) {
      const blocker = byId.get(b);
      if (blocker && blocker.cycle > issue.cycle) {
        warnings.push({
          kind: "dependency",
          message: `“${issue.title}” is scheduled in cycle ${issue.cycle} but is blocked by “${blocker.title}” in cycle ${blocker.cycle}`,
          issueIds: [issue.id, blocker.id],
        });
      }
    }
    if (!issue.assigneeId) warnings.push({ kind: "unassigned", message: `“${issue.title}” has no owner`, issueIds: [issue.id] });
    const owner = team.find((m) => m.id === issue.assigneeId);
    if (owner && !owner.skills.includes(issue.kind)) {
      warnings.push({
        kind: "skill-mismatch",
        message: `${owner.name.split(" ")[0]} owns “${issue.title}” (${issue.kind}) without that skill listed`,
        issueIds: [issue.id],
      });
    }
  }
  if (hasCycle(plan.issues)) warnings.push({ kind: "circular", message: "Some issues block each other in a loop", issueIds: [] });
  return warnings;
}

function hasCycle(issues: PlannedIssue[]): boolean {
  const byId = new Map(issues.map((i) => [i.id, i]));
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const b of byId.get(id)?.blockedBy ?? []) if (byId.has(b) && visit(b)) return true;
    state.set(id, 2);
    return false;
  };
  return issues.some((i) => visit(i.id));
}

export interface BalanceChange {
  issueId: string;
  title: string;
  from: string;
  to: string;
}

/**
 * Resolve over-capacity without breaking dependencies:
 * 1) hand issues to a teammate with the right skill and room in the same cycle;
 * 2) otherwise push issues nothing else depends on into a later cycle that has room.
 */
export function autoBalance(plan: Plan, team: TeamMember[]): { plan: Plan; changes: BalanceChange[] } {
  const issues = plan.issues.map((i) => ({ ...i }));
  const changes: BalanceChange[] = [];
  const name = (id: string | null) => team.find((m) => m.id === id)?.name.split(" ")[0] ?? "unassigned";
  const load = (memberId: string, cycle: number) =>
    issues.filter((i) => i.assigneeId === memberId && i.cycle === cycle).reduce((s, i) => s + i.estimate, 0);
  const cap = (memberId: string) => team.find((m) => m.id === memberId)?.capacity ?? 0;
  const dependents = (id: string) => issues.filter((i) => i.blockedBy.includes(id));

  for (const member of team) {
    for (const cycle of plan.cycles.map((c) => c.number)) {
      // Move the smallest issues first: least disruptive.
      const mine = issues.filter((i) => i.assigneeId === member.id && i.cycle === cycle).sort((a, b) => a.estimate - b.estimate);
      for (const issue of mine) {
        if (load(member.id, cycle) <= member.capacity) break;
        const helper = team
          .filter((m) => m.id !== member.id && m.skills.includes(issue.kind) && load(m.id, cycle) + issue.estimate <= m.capacity)
          .sort((a, b) => load(a.id, cycle) / a.capacity - load(b.id, cycle) / b.capacity)[0];
        if (helper) {
          changes.push({ issueId: issue.id, title: issue.title, from: `${name(issue.assigneeId)} · cycle ${cycle}`, to: `${helper.name.split(" ")[0]} · cycle ${cycle}` });
          issue.assigneeId = helper.id;
          continue;
        }
        const next = cycle + 1;
        const canDefer =
          next <= plan.cycles.length && dependents(issue.id).every((d) => d.cycle >= next) && load(member.id, next) + issue.estimate <= cap(member.id);
        if (canDefer) {
          changes.push({ issueId: issue.id, title: issue.title, from: `${name(issue.assigneeId)} · cycle ${cycle}`, to: `${name(issue.assigneeId)} · cycle ${next}` });
          issue.cycle = next;
        }
      }
    }
  }
  return { plan: { ...plan, issues: enforceDependencyOrder(issues) }, changes };
}

export function totals(plan: Plan, team: TeamMember[]) {
  const points = plan.issues.reduce((s, i) => s + i.estimate, 0);
  const capacity = team.reduce((s, m) => s + m.capacity, 0) * plan.cycles.length;
  return { points, capacity, issues: plan.issues.length, projects: plan.projects.length, utilization: capacity ? points / capacity : 0 };
}
