export function fmt(d: string | null): string {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function fmtFull(d: string | null): string {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === "done") return false;
  const today = isoDate(new Date());
  return dueDate < today;
}

// Used to hide tasks completed more than N days ago from the board.
export function daysSince(dateStr: string): number {
  return daysBetween(dateStr, isoDate(new Date()));
}

// While a task sits in On Hold or In Review, its due date effectively grows
// by a day for every day that's passed since it entered that state — this
// computes that "as of right now" without needing the stored value to
// change daily. Once the task leaves On Hold/In Review, the database bakes
// the accumulated extension into the real due_date and this just returns
// that stored value unchanged.
export function effectiveDueDate(
  dueDate: string | null,
  status: string,
  holdStartedAt: string | null
): string | null {
  if (!dueDate) return dueDate;
  if ((status === "on_hold" || status === "review") && holdStartedAt) {
    const extraDays = daysSince(holdStartedAt);
    if (extraDays > 0) {
      return isoDate(addDays(new Date(dueDate + "T00:00:00"), extraDays));
    }
  }
  return dueDate;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
