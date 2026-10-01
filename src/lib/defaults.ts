import type { Goal, TeamMember } from "./types";

// Fictional team and goals for a two-vertical health-AI startup.

export const DEFAULT_TEAM: TeamMember[] = [
  { id: "sam", name: "Sam Rivera", role: "Founder & CEO", skills: ["partnerships", "hiring"], capacity: 6 },
  { id: "dev", name: "Dev Patel", role: "CTO", skills: ["engineering", "research", "design"], capacity: 13 },
  { id: "priya", name: "Priya Natarajan", role: "Clinical Lead", skills: ["research", "regulatory", "partnerships"], capacity: 10 },
  { id: "marcus", name: "Marcus Hale", role: "Performance Lead", skills: ["growth", "partnerships", "design"], capacity: 10 },
  { id: "javier", name: "Javier Monestel", role: "Executive Assistant", skills: ["ops", "hiring", "partnerships"], capacity: 12 },
];

export const GOAL_TEMPLATES: { label: string; goals: Omit<Goal, "id">[] }[] = [
  {
    label: "October goals (both lines)",
    goals: [
      { line: "clinical", text: "Sign 2 health-system pilot LOIs" },
      { line: "clinical", text: "Complete the retrospective validation study for potassium estimation" },
      { line: "performance", text: "Grow paid athlete memberships from 3,100 to 4,000" },
      { line: "performance", text: "Launch the coach dashboard for endurance clubs" },
      { line: "company", text: "Hire a second ML engineer" },
      { line: "company", text: "Automate the weekly investor and board update" },
    ],
  },
  {
    label: "Clinical sprint",
    goals: [
      { line: "clinical", text: "Submit the FDA pre-submission package" },
      { line: "clinical", text: "Sign data-use agreements with 2 new research sites" },
      { line: "clinical", text: "Ship the nurse-coordinator alert queue for pilot sites" },
    ],
  },
  {
    label: "Performance growth push",
    goals: [
      { line: "performance", text: "Lift waitlist-to-trial conversion from 13% to 20%" },
      { line: "performance", text: "Support 2 more heart-rate strap models" },
      { line: "performance", text: "Close 3 endurance club team plans" },
    ],
  },
];

export function makeGoals(goals: Omit<Goal, "id">[]): Goal[] {
  return goals.map((g, i) => ({ ...g, id: `g${i + 1}` }));
}
