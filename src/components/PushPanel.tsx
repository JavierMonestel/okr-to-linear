"use client";

import { useMemo, useState } from "react";
import { buildOperations, toCsv } from "@/lib/linear";
import type { Plan, TeamMember } from "@/lib/types";
import { btn, cn, Panel, Spinner } from "./ui";

interface PushResult {
  mode: "dry_run" | "live";
  note?: string;
  results: { ref: string; label: string; status: string; url?: string; identifier?: string; error?: string }[];
}

export function PushPanel({ plan, team }: { plan: Plan; team: TeamMember[] }) {
  const operations = useMemo(() => buildOperations(plan), [plan]);
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const counts = {
    projects: operations.filter((o) => o.kind === "projectCreate").length,
    issues: operations.filter((o) => o.kind === "issueCreate").length,
    relations: operations.filter((o) => o.kind === "issueRelationCreate").length,
  };

  const push = async () => {
    setPushing(true);
    setError(null);
    try {
      const res = await fetch("/api/linear/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, team }) });
      if (!res.ok) throw new Error(`Push failed (${res.status})`);
      setResult(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setPushing(false);
    }
  };

  const download = (filename: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Panel className="xl:col-span-2" title={`${operations.length} GraphQL operations, executed in order`}>
        <div className="mb-4 grid grid-cols-3 gap-3">
          {[
            ["Projects", counts.projects, "projectCreate"],
            ["Issues", counts.issues, "issueCreate"],
            ["Dependencies", counts.relations, "issueRelationCreate · blocks"],
          ].map(([label, n, op]) => (
            <div key={label} className="rounded-lg border border-slate-200 p-3">
              <div className="text-2xl font-semibold tabular-nums text-slate-900">{n}</div>
              <div className="text-xs text-slate-500">{label}</div>
              <div className="mt-1 font-mono text-[10.5px] text-indigo-600">{op}</div>
            </div>
          ))}
        </div>
        <ol className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
          {operations.map((op, idx) => {
            const r = result?.results.find((x) => x.ref === op.ref);
            return (
              <li key={op.ref}>
                <details className="group rounded-lg border border-slate-200 open:bg-slate-50">
                  <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[13px]">
                    <span className="w-6 shrink-0 font-mono text-[11px] text-slate-400">{idx + 1}</span>
                    <span className="shrink-0 font-mono text-[11px] text-indigo-600">{op.kind}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-700">{op.label}</span>
                    {r && (
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-medium",
                          r.status === "created" ? "bg-emerald-50 text-emerald-700" : r.status === "dry_run" ? "bg-slate-100 text-slate-600" : "bg-rose-50 text-rose-700",
                        )}
                      >
                        {r.identifier ?? r.status.replace("_", " ")}
                      </span>
                    )}
                  </summary>
                  <pre className="overflow-x-auto border-t border-slate-200 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-700">
                    {op.query}
                    {"\n\n"}
                    {JSON.stringify(op.variables, null, 2)}
                  </pre>
                </details>
              </li>
            );
          })}
        </ol>
      </Panel>

      <div className="space-y-4">
        <Panel title="Push to Linear">
          <p className="text-sm leading-relaxed text-slate-600">
            Creates one Linear project per goal, every issue with estimate, owner, cycle and due date, then the <em>blocks</em> relations. IDs created by earlier
            steps (and workspace users and cycles) are resolved as it goes.
          </p>
          <button type="button" className={cn(btn.primary, "mt-4 w-full")} onClick={push} disabled={pushing}>
            {pushing && <Spinner />}
            {pushing ? "Pushing…" : "Push plan to Linear"}
          </button>
          {result && (
            <div className={cn("mt-3 rounded-lg px-3 py-2 text-sm", result.mode === "live" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700")}>
              {result.mode === "live"
                ? `Created ${result.results.filter((r) => r.status === "created").length} of ${result.results.length} objects in Linear.`
                : `Dry run: ${result.results.length} operations validated. ${result.note ?? ""}`}
            </div>
          )}
          {error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        </Panel>
        <Panel title="Export">
          <div className="flex flex-col gap-2">
            <button type="button" className={btn.secondary} onClick={() => download(`linear-plan-${plan.month}.csv`, toCsv(plan, team), "text/csv")}>
              ⬇ CSV (Linear importer / Sheets)
            </button>
            <button type="button" className={btn.secondary} onClick={() => download(`linear-plan-${plan.month}.json`, JSON.stringify({ plan, team }, null, 2), "application/json")}>
              ⬇ JSON (plan + team)
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
