"use client";

import type { TaskKind, TeamMember } from "@/lib/types";
import { KINDS } from "@/lib/types";
import { Avatar, cn } from "./ui";

export function TeamEditor({ team, onChange }: { team: TeamMember[]; onChange: (team: TeamMember[]) => void }) {
  const update = (id: string, patch: Partial<TeamMember>) => onChange(team.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const toggleSkill = (m: TeamMember, kind: TaskKind) =>
    update(m.id, { skills: m.skills.includes(kind) ? m.skills.filter((k) => k !== kind) : [...m.skills, kind] });

  return (
    <ul className="divide-y divide-slate-100">
      {team.map((m) => (
        <li key={m.id} className="py-2.5 first:pt-0 last:pb-0">
          <div className="flex items-center gap-2.5">
            <Avatar member={m} size="md" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-900">{m.name}</div>
              <div className="truncate text-xs text-slate-500">{m.role}</div>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input
                type="number"
                min={0}
                max={60}
                value={m.capacity}
                onChange={(e) => update(m.id, { capacity: Math.max(0, Number(e.target.value) || 0) })}
                className="w-14 rounded-md border border-slate-200 px-1.5 py-1 text-right text-sm tabular-nums text-slate-900 focus:border-indigo-400 focus:outline-none"
                aria-label={`Capacity for ${m.name}`}
              />
              pts/cycle
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-1 pl-[38px]">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => toggleSkill(m, k)}
                aria-pressed={m.skills.includes(k)}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10.5px] font-medium transition-colors",
                  m.skills.includes(k) ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200" : "text-slate-400 hover:bg-slate-50",
                )}
              >
                {k}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
