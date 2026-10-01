"use client";

import { GOAL_TEMPLATES, makeGoals } from "@/lib/defaults";
import type { Goal, Line } from "@/lib/types";
import { LINES, LINE_LABEL } from "@/lib/types";
import { btn, cn, input, LINE_STYLE } from "./ui";

export function GoalsEditor({ goals, onChange }: { goals: Goal[]; onChange: (goals: Goal[]) => void }) {
  const update = (id: string, patch: Partial<Goal>) => onChange(goals.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const nextId = () => `g${Math.max(0, ...goals.map((g) => Number(g.id.slice(1)) || 0)) + 1}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {GOAL_TEMPLATES.map((t) => (
          <button key={t.label} type="button" className={btn.ghost} onClick={() => onChange(makeGoals(t.goals))}>
            ↺ {t.label}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {goals.map((g) => (
          <li key={g.id} className="flex items-start gap-2">
            <span className="w-6 shrink-0 pt-2 font-mono text-[11px] text-slate-400">{g.id}</span>
            <select
              aria-label={`Business line for ${g.id}`}
              value={g.line}
              onChange={(e) => update(g.id, { line: e.target.value as Line })}
              className={cn("mt-1 shrink-0 rounded-md border-0 px-1.5 py-1 text-xs font-medium ring-1 ring-inset", LINE_STYLE[g.line])}
            >
              {LINES.map((l) => (
                <option key={l} value={l}>
                  {LINE_LABEL[l]}
                </option>
              ))}
            </select>
            <textarea aria-label={`Goal ${g.id}`} rows={1} value={g.text} onChange={(e) => update(g.id, { text: e.target.value })} className={cn(input, "min-h-9 resize-none leading-snug [field-sizing:content]")} />
            <button type="button" aria-label={`Remove ${g.id}`} className="mt-1 shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600" onClick={() => onChange(goals.filter((x) => x.id !== g.id))}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      {goals.length < 12 && (
        <button type="button" className={btn.ghost} onClick={() => onChange([...goals, { id: nextId(), line: "company", text: "" }])}>
          + Add goal
        </button>
      )}
    </div>
  );
}
