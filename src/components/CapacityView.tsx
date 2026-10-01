"use client";

import { capacityTable, type BalanceChange } from "@/lib/analysis";
import { formatRange } from "@/lib/dates";
import type { Plan, TeamMember } from "@/lib/types";
import { Avatar, btn, cn, Panel } from "./ui";

export function CapacityView({
  plan,
  team,
  onBalance,
  changes,
}: {
  plan: Plan;
  team: TeamMember[];
  onBalance: () => void;
  changes: BalanceChange[] | null;
}) {
  const cells = capacityTable(plan, team);
  const cell = (memberId: string, cycle: number) => cells.find((c) => c.memberId === memberId && c.cycle === cycle)!;
  const over = cells.filter((c) => c.points > c.capacity);

  // Which skill is the bottleneck? Sum demand vs. supply per kind.
  const demand = new Map<string, number>();
  for (const i of plan.issues) demand.set(i.kind, (demand.get(i.kind) ?? 0) + i.estimate);
  const bottlenecks = [...demand.entries()]
    .map(([kind, pts]) => {
      const supply = team.filter((m) => m.skills.includes(kind as never)).reduce((s, m) => s + m.capacity * plan.cycles.length, 0);
      return { kind, pts, supply, ratio: supply ? pts / supply : Infinity };
    })
    .filter((b) => b.ratio > 0.85)
    .sort((a, b) => b.ratio - a.ratio);

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Panel
        className="xl:col-span-2"
        title="Load per person and cycle"
        action={
          <button type="button" className={btn.secondary} onClick={onBalance} disabled={over.length === 0}>
            ⚖ Auto-balance
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="pb-2 font-medium">Person</th>
                {plan.cycles.map((c) => (
                  <th key={c.number} className="pb-2 font-medium">
                    Cycle {c.number} <span className="normal-case text-slate-400">· {formatRange(c)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {team.map((m) => (
                <tr key={m.id}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <Avatar member={m} size="md" />
                      <div>
                        <div className="font-medium text-slate-900">{m.name.split(" ")[0]}</div>
                        <div className="text-xs text-slate-500">{m.capacity} pts / cycle</div>
                      </div>
                    </div>
                  </td>
                  {plan.cycles.map((c) => {
                    const x = cell(m.id, c.number);
                    const ratio = x.capacity ? x.points / x.capacity : x.points ? 2 : 0;
                    return (
                      <td key={c.number} className="py-3 pr-4 align-top">
                        <div className="flex items-center justify-between text-xs">
                          <span className={cn("font-semibold tabular-nums", ratio > 1 ? "text-rose-600" : ratio > 0.85 ? "text-amber-600" : "text-slate-700")}>
                            {x.points} / {x.capacity}
                          </span>
                          <span className="text-slate-400">{x.issues.length} {x.issues.length === 1 ? "issue" : "issues"}</span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn("h-2 rounded-full", ratio > 1 ? "bg-rose-500" : ratio > 0.85 ? "bg-amber-400" : "bg-emerald-500")}
                            style={{ width: `${Math.min(100, ratio * 100)}%` }}
                          />
                        </div>
                        <div className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-slate-400" title={x.issues.map((i) => i.title).join("\n")}>
                          {x.issues.map((i) => i.id).join(" · ")}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="Bottlenecks">
          {bottlenecks.length === 0 ? (
            <p className="text-sm text-slate-500">Demand fits within the team&apos;s skills and capacity.</p>
          ) : (
            <ul className="space-y-3">
              {bottlenecks.map((b) => (
                <li key={b.kind} className="text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium capitalize text-slate-900">{b.kind}</span>
                    <span className={cn("tabular-nums", b.ratio > 1 ? "text-rose-600" : "text-amber-600")}>
                      {b.pts} pts needed / {b.supply} available
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Only {team.filter((m) => m.skills.includes(b.kind as never)).map((m) => m.name.split(" ")[0]).join(", ") || "nobody"} can take {b.kind} work.
                    {b.ratio > 1 ? " Cut scope, add a contractor, or move a goal to next month." : " Little slack left."}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {changes && (
          <Panel title={`Auto-balance: ${changes.length} change${changes.length === 1 ? "" : "s"}`}>
            {changes.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing could be moved without breaking a dependency or overloading someone else.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {changes.map((c) => (
                  <li key={c.issueId}>
                    <span className="font-mono text-slate-400">{c.issueId}</span> <span className="text-slate-700">{c.title}</span>
                    <div className="text-slate-500">
                      {c.from} → <span className="font-medium text-emerald-700">{c.to}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
