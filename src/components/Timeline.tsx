"use client";

import { formatRange } from "@/lib/dates";
import type { Plan, TeamMember } from "@/lib/types";
import { Avatar, cn, LineBadge } from "./ui";

export function Timeline({ plan, team, flagged }: { plan: Plan; team: TeamMember[]; flagged: Set<string> }) {
  const cols = `minmax(220px, 1.2fr) repeat(${plan.cycles.length}, minmax(240px, 1fr))`;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="min-w-[760px]">
        <div className="grid border-b border-slate-100 bg-slate-50 text-[11px] font-medium uppercase tracking-wide text-slate-500" style={{ gridTemplateColumns: cols }}>
          <div className="px-4 py-2.5">Project</div>
          {plan.cycles.map((c) => (
            <div key={c.number} className="border-l border-slate-100 px-4 py-2.5">
              Cycle {c.number} <span className="normal-case text-slate-400">· {formatRange(c)}</span>
            </div>
          ))}
        </div>
        {plan.projects.map((p) => (
          <div key={p.goalId} className="grid border-b border-slate-100 last:border-0" style={{ gridTemplateColumns: cols }}>
            <div className="px-4 py-3">
              <LineBadge line={p.line} />
              <div className="mt-1 text-[13px] font-medium leading-snug text-slate-900">{p.name}</div>
            </div>
            {plan.cycles.map((c) => (
              <div key={c.number} className="space-y-1.5 border-l border-slate-100 px-3 py-3">
                {plan.issues
                  .filter((i) => i.goalId === p.goalId && i.cycle === c.number)
                  .map((i) => (
                    <div
                      key={i.id}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-2 py-1.5 text-[12px] leading-snug",
                        flagged.has(i.id) ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white",
                      )}
                      title={i.blockedBy.length ? `Blocked by ${i.blockedBy.join(", ")}` : undefined}
                    >
                      <Avatar member={team.find((m) => m.id === i.assigneeId)} />
                      <span className="min-w-0 flex-1 truncate text-slate-700">{i.title}</span>
                      <span className="shrink-0 tabular-nums text-slate-400">{i.estimate}</span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
