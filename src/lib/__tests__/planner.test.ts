import { describe, expect, it } from "vitest";
import { analyzePlan, autoBalance, capacityTable } from "../analysis";
import { cyclesForMonth } from "../dates";
import { DEFAULT_TEAM, GOAL_TEMPLATES, makeGoals } from "../defaults";
import { buildOperations, resolvePlaceholders, toCsv } from "../linear";
import { criticalPath, enforceDependencyOrder, planWithRules, snapEstimate } from "../planner";
import { objectOf, playbookFor } from "../playbooks";
import type { PlannedIssue } from "../types";

const req = { month: "2026-10", goals: makeGoals(GOAL_TEMPLATES[0].goals), team: DEFAULT_TEAM };
const plan = planWithRules(req, new Date("2026-10-01T12:00:00Z"));

describe("cycles", () => {
  it("splits a month into two-week cycles starting on the first Monday", () => {
    expect(cyclesForMonth("2026-10")).toEqual([
      { number: 1, start: "2026-10-05", end: "2026-10-16" },
      { number: 2, start: "2026-10-19", end: "2026-10-30" },
    ]);
    expect(cyclesForMonth("2026-06")[0].start).toBe("2026-06-01"); // June 1st 2026 is a Monday
  });
});

describe("playbooks", () => {
  it.each([
    ["Sign 2 health-system pilot LOIs", "partnerships"],
    ["Complete the retrospective validation study", "research"],
    ["Grow paid athlete memberships from 3,100 to 4,000", "growth"],
    ["Launch the coach dashboard for endurance clubs", "ship"],
    ["Hire a second ML engineer", "hiring"],
    ["Automate the weekly investor update", "automation"],
    ["Submit the FDA pre-submission package", "regulatory"],
    ["Plan the offsite", "generic"],
  ])("%s -> %s", (goal, playbook) => {
    expect(playbookFor(goal).id).toBe(playbook);
  });

  it("extracts the object of a goal", () => {
    expect(objectOf("Sign 2 health-system pilot LOIs")).toBe("2 health-system pilot LOIs");
    expect(objectOf("Grow paid athlete memberships from 3,100 to 4,000")).toBe("paid athlete memberships");
  });

  it("drops line-specific steps that don't apply (security pack is clinical only)", () => {
    const perf = planWithRules({ ...req, goals: [{ id: "g1", line: "performance", text: "Close 3 endurance club team plans" }] });
    expect(perf.issues.some((i) => i.title.includes("security and compliance"))).toBe(false);
    const clin = planWithRules({ ...req, goals: [{ id: "g1", line: "clinical", text: "Sign 2 health-system pilot LOIs" }] });
    expect(clin.issues.some((i) => i.title.includes("security and compliance"))).toBe(true);
    // Dependencies still point at real issues after filtering.
    const ids = new Set(perf.issues.map((i) => i.id));
    expect(perf.issues.flatMap((i) => i.blockedBy).every((b) => ids.has(b))).toBe(true);
  });
});

describe("planWithRules", () => {
  it("creates one project per goal and fills every issue", () => {
    expect(plan.projects).toHaveLength(6);
    expect(plan.issues.length).toBeGreaterThan(25);
    for (const i of plan.issues) {
      expect(i.assigneeId).not.toBeNull();
      expect([1, 2, 3, 5, 8]).toContain(i.estimate);
      expect(i.cycle).toBeGreaterThanOrEqual(1);
      expect(i.cycle).toBeLessThanOrEqual(2);
    }
  });

  it("never schedules an issue before its blockers", () => {
    const byId = new Map(plan.issues.map((i) => [i.id, i]));
    for (const i of plan.issues) for (const b of i.blockedBy) expect(byId.get(b)!.cycle).toBeLessThanOrEqual(i.cycle);
  });

  it("assigns by skill", () => {
    const skill = new Map(DEFAULT_TEAM.map((m) => [m.id, m.skills]));
    for (const i of plan.issues) expect(skill.get(i.assigneeId!)).toContain(i.kind);
  });

  it("marks the critical path as high priority", () => {
    const hiring = plan.issues.filter((i) => i.goalId === "g5");
    expect(hiring.find((i) => i.title.startsWith("Reference checks"))!.priority).toBe(2);
    const crit = criticalPath(plan.issues);
    expect(plan.issues.filter((i) => crit.has(i.id)).every((i) => i.priority === 2)).toBe(true);
  });
});

describe("analysis", () => {
  it("flags over-capacity and dependency problems", () => {
    const broken = {
      ...plan,
      issues: plan.issues.map((i) => (i.id === "g5-1" ? { ...i, cycle: 2 } : i.id === "g5-3" ? { ...i, cycle: 1 } : i)),
    };
    const kinds = analyzePlan(broken, DEFAULT_TEAM).map((w) => w.kind);
    expect(kinds).toContain("dependency");
    expect(analyzePlan(plan, DEFAULT_TEAM).some((w) => w.kind === "over-capacity")).toBe(true);
  });

  it("auto-balance reduces overload without breaking dependencies", () => {
    const overload = (p: typeof plan) => capacityTable(p, DEFAULT_TEAM).reduce((s, c) => s + Math.max(0, c.points - c.capacity), 0);
    const { plan: balanced, changes } = autoBalance(plan, DEFAULT_TEAM);
    expect(changes.length).toBeGreaterThan(0);
    expect(overload(balanced)).toBeLessThan(overload(plan));
    expect(analyzePlan(balanced, DEFAULT_TEAM).some((w) => w.kind === "dependency")).toBe(false);
    // Total work is preserved.
    expect(balanced.issues.reduce((s, i) => s + i.estimate, 0)).toBe(plan.issues.reduce((s, i) => s + i.estimate, 0));
  });

  it("enforceDependencyOrder pushes dependents forward", () => {
    const issues: PlannedIssue[] = [
      { ...plan.issues[0], id: "a", blockedBy: [], cycle: 2 },
      { ...plan.issues[0], id: "b", blockedBy: ["a"], cycle: 1 },
    ];
    expect(enforceDependencyOrder(issues).find((i) => i.id === "b")!.cycle).toBe(2);
  });

  it("snaps estimates to the Fibonacci scale", () => {
    expect([snapEstimate(4), snapEstimate(7), snapEstimate(13), snapEstimate(0)]).toEqual([3, 8, 8, 1]);
  });
});

describe("Linear export", () => {
  const ops = buildOperations(plan, "team_123");

  it("creates projects, then issues, then relations", () => {
    const kinds = ops.map((o) => o.kind);
    expect(kinds.indexOf("issueCreate")).toBeGreaterThan(kinds.lastIndexOf("projectCreate"));
    expect(kinds.indexOf("issueRelationCreate")).toBeGreaterThan(kinds.lastIndexOf("issueCreate"));
    expect(ops.filter((o) => o.kind === "issueRelationCreate")).toHaveLength(plan.issues.reduce((s, i) => s + i.blockedBy.length, 0));
  });

  it("references earlier results through placeholders that resolve or drop cleanly", () => {
    const issueOp = ops.find((o) => o.kind === "issueCreate")!;
    expect(issueOp.variables.input.projectId).toBe("{{project:g1}}");
    const resolved = resolvePlaceholders(issueOp.variables, new Map([["project:g1", "proj_1"]]));
    expect(resolved.input.projectId).toBe("proj_1");
    expect("cycleId" in resolved.input).toBe(false); // unknown cycle -> omitted, not sent as a bogus id
    expect(resolved.input.teamId).toBe("team_123");
  });

  it("writes a CSV with escaped fields and one row per issue", () => {
    const csv = toCsv(plan, DEFAULT_TEAM);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("ID,Title,Description,Project,Assignee,Estimate,Priority,Cycle,Due Date,Labels,Blocked By");
    expect(lines).toHaveLength(plan.issues.length + 1);
    expect(csv).toContain('"Map the current process for the weekly investor and board update: steps, owners, time spent"');
  });
});
