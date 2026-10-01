import type { ReactNode } from "react";
import type { Line, LinearPriority, TaskKind, TeamMember } from "@/lib/types";
import { LINE_LABEL } from "@/lib/types";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export const LINE_STYLE: Record<Line, string> = {
  clinical: "bg-teal-50 text-teal-700 ring-teal-600/20",
  performance: "bg-orange-50 text-orange-700 ring-orange-600/20",
  company: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
};

export function LineBadge({ line }: { line: Line }) {
  return <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", LINE_STYLE[line])}>{LINE_LABEL[line]}</span>;
}

const KIND_STYLE: Record<TaskKind, string> = {
  engineering: "text-violet-700 bg-violet-50",
  research: "text-sky-700 bg-sky-50",
  regulatory: "text-rose-700 bg-rose-50",
  partnerships: "text-emerald-700 bg-emerald-50",
  growth: "text-amber-700 bg-amber-50",
  ops: "text-slate-700 bg-slate-100",
  hiring: "text-fuchsia-700 bg-fuchsia-50",
  design: "text-cyan-700 bg-cyan-50",
};

export function KindBadge({ kind }: { kind: TaskKind }) {
  return <span className={cn("rounded px-1.5 py-0.5 text-[10.5px] font-medium", KIND_STYLE[kind])}>{kind}</span>;
}

export function PriorityIcon({ priority }: { priority: LinearPriority }) {
  // Linear-style signal bars: urgent = !, high = 3 bars, medium = 2, low = 1.
  if (priority === 1) {
    return <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-orange-500 text-[10px] font-bold text-white" title="Urgent">!</span>;
  }
  const bars = 5 - priority; // 2 -> 3 bars, 3 -> 2, 4 -> 1
  return (
    <span className="inline-flex h-3.5 items-end gap-[2px]" title={["", "Urgent", "High", "Medium", "Low"][priority]}>
      {[1, 2, 3].map((b) => (
        <span key={b} className={cn("w-[3px] rounded-sm", b <= bars ? "bg-slate-600" : "bg-slate-200")} style={{ height: `${4 + b * 3}px` }} />
      ))}
    </span>
  );
}

const AVATAR_COLORS = ["bg-indigo-500", "bg-teal-500", "bg-orange-500", "bg-rose-500", "bg-violet-500", "bg-sky-500", "bg-emerald-500"];

export function Avatar({ member, size = "sm" }: { member: TeamMember | undefined; size?: "sm" | "md" }) {
  if (!member) {
    return <span className={cn("inline-flex items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400", size === "sm" ? "h-5 w-5 text-[9px]" : "h-7 w-7 text-xs")}>?</span>;
  }
  const initials = member.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const color = AVATAR_COLORS[[...member.id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <span title={member.name} className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", color, size === "sm" ? "h-5 w-5 text-[9px]" : "h-7 w-7 text-[11px]")}>
      {initials}
    </span>
  );
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export const btn = {
  primary: "inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50",
  dark: "inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50",
  secondary: "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50",
  ghost: "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900",
};

export const input =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export function Spinner() {
  return <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />;
}
