import type { Estimate, Line, TaskKind } from "./types";

// Rules-engine decomposition: each monthly goal is matched to an archetype, and the
// archetype's playbook expands into issues with estimates and dependencies.
// {object} is the goal minus its leading verb ("Sign 2 health-system pilot LOIs" ->
// "2 health-system pilot LOIs").

export interface Step {
  title: string;
  kind: TaskKind;
  estimate: Estimate;
  /** Indexes of earlier steps that block this one. */
  after?: number[];
  done: string; // acceptance criterion
  /** Only include for these business lines. */
  lines?: Line[];
}

export interface Playbook {
  id: string;
  label: string;
  match: RegExp;
  summary: string;
  steps: Step[];
}

export const PLAYBOOKS: Playbook[] = [
  {
    id: "regulatory",
    label: "Regulatory submission",
    match: /\b(fda|pre-?sub(mission)?|submission|regulatory|510\(k\)|ce mark)\b/i,
    summary: "Assemble, review and submit the regulatory package on a predictable timeline.",
    steps: [
      { title: "Gap analysis of {object} against current FDA guidance", kind: "regulatory", estimate: 3, done: "Gap list with owners for every missing section" },
      { title: "Draft device description and intended-use sections", kind: "regulatory", estimate: 3, done: "Sections reviewed by the clinical lead" },
      { title: "Compile the performance-data section from validation results", kind: "research", estimate: 5, after: [0], done: "Tables and figures final, sources cited" },
      { title: "Internal review with the regulatory consultant", kind: "regulatory", estimate: 2, after: [1, 2], done: "All consultant comments resolved" },
      { title: "Submit {object} and request the Q-Sub meeting", kind: "regulatory", estimate: 1, after: [3], done: "Submission confirmation received" },
    ],
  },
  {
    id: "hiring",
    label: "Hiring",
    match: /\b(hire|hiring|recruit|headcount)\b/i,
    summary: "Run a structured, fast hiring loop with a clear scorecard.",
    steps: [
      { title: "Write job description and interview scorecard for {object}", kind: "hiring", estimate: 2, done: "JD and scorecard approved by the hiring manager" },
      { title: "Set up the Notion hiring page and interview loop", kind: "ops", estimate: 2, done: "Loop, panel and calendar holds in place" },
      { title: "Source 30 qualified candidates", kind: "hiring", estimate: 3, after: [0], done: "30 candidates in the pipeline with notes" },
      { title: "Run first-round screens", kind: "hiring", estimate: 3, after: [1, 2], done: "Shortlist of 5 with written feedback" },
      { title: "Technical interviews and debriefs", kind: "engineering", estimate: 3, after: [3], done: "Debrief decision for every finalist" },
      { title: "Reference checks and offer", kind: "hiring", estimate: 2, after: [4], done: "Offer sent" },
    ],
  },
  {
    id: "automation",
    label: "Process automation",
    match: /\b(automate|automation|workflow|process|single source)\b/i,
    summary: "Replace a manual recurring process with a documented, monitored automation.",
    steps: [
      { title: "Map the current process for {object}: steps, owners, time spent", kind: "ops", estimate: 2, done: "Process map and baseline hours/week" },
      { title: "Define data sources, template and approval step", kind: "ops", estimate: 2, after: [0], done: "Template signed off by the founder" },
      { title: "Build the automation (Zapier/Make + Claude) for {object}", kind: "ops", estimate: 3, after: [1], done: "End-to-end run on real data" },
      { title: "Dry-run for two cycles and fix gaps", kind: "ops", estimate: 2, after: [2], done: "Two clean runs with no manual edits" },
      { title: "Document the runbook in Notion", kind: "ops", estimate: 1, after: [2], done: "Runbook linked from the ops wiki" },
    ],
  },
  {
    id: "growth",
    label: "Growth metric",
    match: /\b(grow|increase|lift|raise|improve|reduce churn|conversion|retention|from [\d,.%]+ to)\b/i,
    summary: "Find the biggest funnel leak and run focused experiments against the target metric.",
    steps: [
      { title: "Instrument the funnel and baseline {object}", kind: "engineering", estimate: 3, done: "Dashboard with daily baseline" },
      { title: "Analyze drop-off and choose the top two experiments", kind: "growth", estimate: 2, after: [0], done: "Experiment briefs with expected lift" },
      { title: "Build experiment A (onboarding)", kind: "engineering", estimate: 3, after: [1], done: "Shipped behind a flag to 50% of users" },
      { title: "Build experiment B (pricing / offer)", kind: "engineering", estimate: 3, after: [1], done: "Shipped behind a flag to 50% of users" },
      { title: "Launch lifecycle email sequence", kind: "growth", estimate: 3, done: "Sequence live with tracking" },
      { title: "Weekly readout on {object}", kind: "growth", estimate: 1, after: [2, 3], done: "Readout shared in Slack every Friday" },
    ],
  },
  {
    id: "partnerships",
    label: "Partnerships / deals",
    match: /\b(sign|close|land|lois?|letters? of intent|pilots?|partners?|team plans?|contracts?|agreements?|deals?)\b/i,
    summary: "Turn a target list into signed agreements, with every touchpoint logged in the CRM.",
    steps: [
      { title: "Build the target list for {object}", kind: "partnerships", estimate: 2, done: "Ranked list in Attio with owners" },
      { title: "Draft proposal and pricing options for {object}", kind: "partnerships", estimate: 3, after: [0], done: "Proposal template approved by the founder" },
      { title: "Run outreach and first meetings", kind: "partnerships", estimate: 3, after: [0], done: "Meetings held with the top targets" },
      { title: "Prepare the security and compliance pack", kind: "regulatory", estimate: 3, done: "Questionnaire answers + data-flow diagram ready", lines: ["clinical"] },
      { title: "Negotiate and sign {object}", kind: "partnerships", estimate: 3, after: [1, 2], done: "Signed documents stored and logged" },
      { title: "Log every account and next step in Attio", kind: "ops", estimate: 1, done: "Pipeline view current in Attio" },
    ],
  },
  {
    id: "research",
    label: "Clinical evidence",
    match: /\b(validation|study|evidence|cohort|trial|analysis)\b/i,
    summary: "Produce defensible evidence on schedule: protocol, data, analysis, report.",
    steps: [
      { title: "Finalize the analysis protocol for {object}", kind: "research", estimate: 3, done: "Protocol signed off by the clinical lead" },
      { title: "Close open data-use and IRB items with sites", kind: "regulatory", estimate: 3, done: "All sites cleared for data transfer" },
      { title: "Data extraction and cleaning", kind: "engineering", estimate: 5, after: [1], done: "Clean dataset with a data dictionary" },
      { title: "Run the statistical analysis", kind: "research", estimate: 5, after: [0, 2], done: "Primary endpoints computed with CIs" },
      { title: "Write the validation report", kind: "research", estimate: 3, after: [3], done: "Report reviewed by an external advisor" },
    ],
  },
  {
    id: "ship",
    label: "Product launch",
    match: /\b(launch|ship|build|release|support|dashboard|queue|feature|integration)\b/i,
    summary: "Spec, build, beta and launch with customers in the loop.",
    steps: [
      { title: "Write spec and success criteria for {object}", kind: "design", estimate: 2, done: "Spec reviewed by engineering and the line lead" },
      { title: "Design the UX for {object}", kind: "design", estimate: 3, after: [0], done: "Clickable prototype tested with 3 users" },
      { title: "Build the backend for {object}", kind: "engineering", estimate: 5, after: [0], done: "APIs live in staging with tests" },
      { title: "Build the UI for {object}", kind: "engineering", estimate: 5, after: [1, 2], done: "Feature complete in staging" },
      { title: "Beta with 3 customers and fix issues", kind: "growth", estimate: 2, after: [3], done: "Beta feedback triaged; blockers fixed" },
      { title: "Launch announcement and help-center docs", kind: "growth", estimate: 2, after: [4], done: "Announcement sent; docs published" },
    ],
  },
];

export const GENERIC: Playbook = {
  id: "generic",
  label: "General initiative",
  match: /.*/,
  summary: "Scope, plan, execute and review.",
  steps: [
    { title: "Scope {object} and define done", kind: "ops", estimate: 2, done: "One-page brief approved" },
    { title: "Plan milestones and owners", kind: "ops", estimate: 1, after: [0], done: "Milestones in Linear" },
    { title: "Execute the first milestone of {object}", kind: "ops", estimate: 5, after: [1], done: "Milestone shipped" },
    { title: "Review results and decide next steps", kind: "ops", estimate: 1, after: [2], done: "Decision logged" },
  ],
};

export function playbookFor(goal: string): Playbook {
  return PLAYBOOKS.find((p) => p.match.test(goal)) ?? GENERIC;
}

/** "Sign 2 health-system pilot LOIs" -> "2 health-system pilot LOIs"; growth goals keep the metric. */
export function objectOf(goal: string): string {
  const text = goal.trim().replace(/[.!]+$/, "");
  const fromTo = text.match(/^(?:grow|increase|lift|raise|improve)\s+(.+?)\s+from\s+.+$/i);
  if (fromTo) return fromTo[1];
  const rest = text.replace(/^\s*\w+\s+/, "");
  return rest.replace(/^the\s+/i, "the ") || text;
}
