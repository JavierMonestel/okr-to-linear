import type { Cycle } from "./types";

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Split a month into two-week cycles starting on the first Monday on/after the 1st. */
export function cyclesForMonth(month: string, count = 2): Cycle[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (8 - first.getUTCDay()) % 7; // days until Monday (0 if already Monday)
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() + offset);
  return Array.from({ length: count }, (_, i) => {
    const s = new Date(start);
    s.setUTCDate(start.getUTCDate() + i * 14);
    const e = new Date(s);
    e.setUTCDate(s.getUTCDate() + 11); // Monday -> Friday of the following week
    return { number: i + 1, start: iso(s), end: iso(e) };
  });
}

export function currentMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export function formatRange(c: Cycle): string {
  const f = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${f(c.start)} – ${f(c.end)}`;
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
