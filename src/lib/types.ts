export const LINES = ["clinical", "performance", "company"] as const;
export type Line = (typeof LINES)[number];
export const LINE_LABEL: Record<Line, string> = { clinical: "Clinical", performance: "Performance", company: "Company" };

export const KINDS = ["engineering", "research", "regulatory", "partnerships", "growth", "ops", "hiring", "design"] as const;
export type TaskKind = (typeof KINDS)[number];

export const ESTIMATES = [1, 2, 3, 5, 8] as const;
export type Estimate = (typeof ESTIMATES)[number];

/** Linear priority: 1 urgent, 2 high, 3 medium, 4 low */
export type LinearPriority = 1 | 2 | 3 | 4;

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  skills: TaskKind[];
  /** Story points this person can take per cycle (after meetings, support, etc.). */
  capacity: number;
}

export interface Goal {
  id: string;
  line: Line;
  text: string;
}

export interface PlannedProject {
  goalId: string;
  name: string;
  summary: string;
  line: Line;
  /** Measurable outcome the project rolls up to. */
  successMetric: string;
}

export interface PlannedIssue {
  id: string;
  goalId: string;
  title: string;
  description: string;
  kind: TaskKind;
  estimate: Estimate;
  assigneeId: string | null;
  cycle: number; // 1-based within the month
  priority: LinearPriority;
  blockedBy: string[];
}

export interface Cycle {
  number: number;
  start: string; // YYYY-MM-DD
  end: string;
}

export interface Plan {
  month: string; // YYYY-MM
  cycles: Cycle[];
  projects: PlannedProject[];
  issues: PlannedIssue[];
  engine: "claude" | "rules";
  generatedAt: string;
}

export interface PlanRequest {
  month: string;
  goals: Goal[];
  team: TeamMember[];
}
