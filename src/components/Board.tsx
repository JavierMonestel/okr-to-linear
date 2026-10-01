"use client";

import { useState } from "react";
import type { Plan, PlannedIssue, TeamMember } from "@/lib/types";
import { ESTIMATES } from "@/lib/types";
import { Avatar, cn, KindBadge, LineBadge, PriorityIcon } from "./ui";

export function Board({
  plan,
  team,
  flagged,
  onIssueChange,
}: {
  plan: Plan;
  team: TeamMember[];
  flagged: Set<string>;
  onIssueChange: (id: string, patch: Partial<PlannedIssue>) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const member = (id: string | null) => team.find((m) => m.id === id);

  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {plan.projects.map((p) => {
        const issues = plan.issues.filter((i) => i.goalId === p.goalId);
        const points = issues.reduce((s, i) => s + i.estimate, 0);
        return (
          <section key={p.goalId} className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 p-4">
              <div className="mb-1.5 flex items-center gap-2">
                <LineBadge line={p.line} />
                <span className="font-mono text-[11px] text-slate-400">{p.goalId}</span>
                <span className="ml-auto text-xs tabular-nums text-slate-500">
                  {issues.length} issues · {points} pts
                </span>
              </div>
              <h3 className="text-sm font-semibold leading-snug text-slate-900">{p.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{p.summary}</p>
              <p className="mt-1.5 text-xs text-slate-600">
                <span className="font-medium">Success metric:</span> {p.successMetric}
              </p>
            </header>
            <ul className="divide-y divide-slate-100">
              {issues.map((i) => {
                const blockers = i.blockedBy.map((b) => plan.issues.find((x) => x.id === b)).filter(Boolean) as PlannedIssue[];
                const isOpen = open === i.id;
                return (
                  <li key={i.id} className={cn("px-4 py-2.5", flagged.has(i.id) && "bg-amber-50/60")}>
                    <button type="button" onClick={() => setOpen(isOpen ? null : i.id)} className="flex w-full items-start gap-2.5 text-left" aria-expanded={isOpen}>
                      <span className="mt-0.5">
                        <PriorityIcon priority={i.priority} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-snug text-slate-900">{i.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-mono text-slate-400">{i.id}</span>
                          <KindBadge kind={i.kind} />
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 tabular-nums">{i.estimate} pt</span>
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">C{i.cycle}</span>
                          {blockers.length > 0 && <span title={blockers.map((b) => b.title).join("\n")}>⛓ {blockers.map((b) => b.id).join(", ")}</span>}
                          {flagged.has(i.id) && <span className="font-medium text-amber-700">⚠ check</span>}
                        </span>
                      </span>
                      <Avatar member={member(i.assigneeId)} />
                    </button>
                    {isOpen && (
                      <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
                        <div className="grid grid-cols-3 gap-2">
                          <label className="text-[11px] font-medium text-slate-500">
                            Owner
                            <select value={i.assigneeId ?? ""} onChange={(e) => onIssueChange(i.id, { assigneeId: e.target.value || null })} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-900">
                              <option value="">Unassigned</option>
                              {team.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name.split(" ")[0]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-[11px] font-medium text-slate-500">
                            Cycle
                            <select value={i.cycle} onChange={(e) => onIssueChange(i.id, { cycle: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-900">
                              {plan.cycles.map((c) => (
                                <option key={c.number} value={c.number}>
                                  Cycle {c.number}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-[11px] font-medium text-slate-500">
                            Estimate
                            <select value={i.estimate} onChange={(e) => onIssueChange(i.id, { estimate: Number(e.target.value) as PlannedIssue["estimate"] })} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-900">
                              {ESTIMATES.map((e) => (
                                <option key={e} value={e}>
                                  {e} pt
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <p className="whitespace-pre-line text-xs leading-relaxed text-slate-600">{i.description.replaceAll("**", "").replaceAll("_", "")}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
