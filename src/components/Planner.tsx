"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { analyzePlan, autoBalance, totals, type BalanceChange } from "@/lib/analysis";
import { currentMonth, formatRange, monthLabel } from "@/lib/dates";
import { DEFAULT_TEAM, GOAL_TEMPLATES, makeGoals } from "@/lib/defaults";
import { enforceDependencyOrder } from "@/lib/planner";
import type { Goal, Plan, PlannedIssue, TeamMember } from "@/lib/types";
import { Board } from "./Board";
import { CapacityView } from "./CapacityView";
import { GoalsEditor } from "./GoalsEditor";
import { PushPanel } from "./PushPanel";
import { TeamEditor } from "./TeamEditor";
import { Timeline } from "./Timeline";
import { btn, cn, Panel, Spinner } from "./ui";

const TABS = ["Board", "Capacity", "Timeline", "Push to Linear"] as const;
type Tab = (typeof TABS)[number];
const STORAGE_KEY = "okr-to-linear:v1";

interface Saved {
  month: string;
  goals: Goal[];
  team: TeamMember[];
  plan: Plan | null;
}

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null; // storage unavailable or corrupt: start fresh
  }
}

const noopSubscribe = () => () => {};

/** Renders the planner only in the browser, where the saved session can be read synchronously. */
export function PlannerGate({ aiOn, initialPlan }: { aiOn: boolean; initialPlan: Plan }) {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!hydrated) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        <Spinner />
      </div>
    );
  }
  return <Planner aiOn={aiOn} saved={loadSaved()} initialPlan={initialPlan} />;
}

function Planner({ aiOn, saved, initialPlan }: { aiOn: boolean; saved: Saved | null; initialPlan: Plan }) {
  const [month, setMonth] = useState(saved?.month ?? currentMonth());
  const [goals, setGoals] = useState<Goal[]>(saved?.goals ?? makeGoals(GOAL_TEMPLATES[0].goals));
  const [team, setTeam] = useState<TeamMember[]>(saved?.team ?? DEFAULT_TEAM);
  // The server renders a first plan for the default goals so the page is never empty.
  const [plan, setPlan] = useState<Plan | null>(saved?.plan ?? initialPlan);
  const [tab, setTab] = useState<Tab>("Board");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<BalanceChange[] | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);

  const generate = useCallback(
    async (input?: { month: string; goals: Goal[]; team: TeamMember[] }) => {
      const body = input ?? { month, goals: goals.filter((g) => g.text.trim()), team };
      setLoading(true);
      setError(null);
      setChanges(null);
      try {
        const res = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`);
        setPlan(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [month, goals, team],
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ month, goals, team, plan } satisfies Saved));
    } catch {
      // Storage can be unavailable (private mode); the app still works in memory.
    }
  }, [month, goals, team, plan]);

  const warnings = useMemo(() => (plan ? analyzePlan(plan, team) : []), [plan, team]);
  const flagged = useMemo(() => new Set(warnings.flatMap((w) => (w.kind === "over-capacity" ? [] : w.issueIds))), [warnings]);
  const stats = plan ? totals(plan, team) : null;

  const updateIssue = (id: string, patch: Partial<PlannedIssue>) => {
    if (!plan) return;
    const issues = plan.issues.map((i) => (i.id === id ? { ...i, ...patch } : i));
    // Moving a blocker later drags its dependents along so the plan stays valid.
    setPlan({ ...plan, issues: patch.cycle ? enforceDependencyOrder(issues) : issues });
  };

  const balance = () => {
    if (!plan) return;
    const result = autoBalance(plan, team);
    setPlan(result.plan);
    setChanges(result.changes);
  };

  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    const g = makeGoals(GOAL_TEMPLATES[0].goals);
    setMonth(currentMonth());
    setGoals(g);
    setTeam(DEFAULT_TEAM);
    void generate({ month: currentMonth(), goals: g, team: DEFAULT_TEAM });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <Panel
          title="1 · Monthly goals"
          action={
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
              aria-label="Month"
            />
          }
        >
          <GoalsEditor goals={goals} onChange={setGoals} />
        </Panel>
        <Panel title="2 · Team & capacity">
          <TeamEditor team={team} onChange={setTeam} />
        </Panel>
        <button type="button" className={cn(btn.primary, "w-full py-2.5")} onClick={() => generate()} disabled={loading || goals.every((g) => !g.text.trim())}>
          {loading && <Spinner />}
          {loading ? (aiOn ? "Claude is planning…" : "Planning…") : "3 · Generate Linear plan"}
        </button>
        <p className="text-center text-xs text-slate-500">
          {aiOn ? "Planning with Claude (structured outputs)." : "Demo mode: playbook-based planner. Add ANTHROPIC_API_KEY to plan with Claude."}{" "}
          <button type="button" onClick={reset} className="underline underline-offset-2 hover:text-slate-800">
            Reset
          </button>
        </p>
      </aside>

      <section className="min-w-0 space-y-4">
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {!plan && (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Building the plan…
              </span>
            ) : (
              "Add goals and generate a plan."
            )}
          </div>
        )}
        {plan && stats && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">{monthLabel(plan.month)} plan</h1>
                <p className="text-sm text-slate-500">
                  {plan.cycles.map((c) => `Cycle ${c.number}: ${formatRange(c)}`).join(" · ")} · planned by {plan.engine === "claude" ? "Claude" : "playbooks"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Stat label="projects" value={stats.projects} />
                <Stat label="issues" value={stats.issues} />
                <Stat label="points" value={`${stats.points}/${stats.capacity}`} tone={stats.utilization > 1 ? "bad" : stats.utilization > 0.85 ? "warn" : "good"} />
                <button
                  type="button"
                  onClick={() => setShowWarnings((s) => !s)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset",
                    warnings.length ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200",
                  )}
                >
                  {warnings.length ? `⚠ ${warnings.length} to review` : "✓ Plan is consistent"}
                </button>
              </div>
            </div>

            {showWarnings && warnings.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900">
                {warnings.map((w, idx) => (
                  <li key={idx}>
                    <span className="mr-2 rounded bg-white/70 px-1.5 py-0.5 font-mono text-[10.5px] text-amber-700">{w.kind}</span>
                    {w.message}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-1 border-b border-slate-200" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    tab === t ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "Board" && <Board plan={plan} team={team} flagged={flagged} onIssueChange={updateIssue} />}
            {tab === "Capacity" && <CapacityView plan={plan} team={team} onBalance={balance} changes={changes} />}
            {tab === "Timeline" && <Timeline plan={plan} team={team} flagged={flagged} />}
            {tab === "Push to Linear" && <PushPanel plan={plan} team={team} />}
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "good" | "warn" | "bad" }) {
  return (
    <span className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-inset ring-slate-200">
      <b className={cn("tabular-nums", tone === "bad" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-slate-900")}>{value}</b>{" "}
      <span className="text-slate-500">{label}</span>
    </span>
  );
}
