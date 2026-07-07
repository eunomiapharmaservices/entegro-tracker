"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { Task } from "@/lib/types";
import { endOfMonth, isoDate, MONTH_NAMES, startOfMonth, WEEKDAY_SHORT } from "@/lib/dateUtils";

export default function CalendarView({
  tasks,
  onOpenTask,
}: {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}) {
  const [cursor, setCursor] = useState(new Date());

  const first = startOfMonth(cursor);
  const last = endOfMonth(cursor);
  // Monday-first offset
  const startOffset = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + last.getDate()) / 7) * 7;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > last.getDate()) cells.push(null);
    else cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), dayNum));
  }

  function tasksOnDay(d: Date) {
    const iso = isoDate(d);
    const milestones = tasks.filter((t) => t.is_milestone && t.milestone_date === iso);
    const due = tasks.filter((t) => !t.is_milestone && t.due_date === iso);
    return { milestones, due };
  }

  const today = isoDate(new Date());

  return (
    <div className="rounded-xl border border-[var(--c-line)] bg-white p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-lg">
          {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="p-1.5 rounded-md hover:bg-black/5"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="text-xs px-2.5 py-1 rounded-md hover:bg-black/5 text-[#4d574f]"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="p-1.5 rounded-md hover:bg-black/5"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-xs font-medium text-[#8a8578] mb-1 font-display">
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} className="px-2 py-1.5">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr">
        {cells.map((d, i) => {
          if (!d)
            return <div key={i} className="rounded-lg bg-transparent" />;
          const { milestones, due } = tasksOnDay(d);
          const isToday = isoDate(d) === today;
          return (
            <div
              key={i}
              className={`rounded-lg border p-1.5 flex flex-col gap-1 min-h-[80px] overflow-hidden ${
                isToday ? "border-[var(--c-green)] bg-[var(--c-green)]/[0.04]" : "border-[var(--c-line)]"
              }`}
            >
              <span
                className={`text-xs font-mono ${
                  isToday ? "text-[var(--c-green)] font-semibold" : "text-[#a39d8c]"
                }`}
              >
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-1 overflow-y-auto">
                {milestones.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onOpenTask(t)}
                    className="flex items-center gap-1 text-[11px] leading-tight text-left bg-[var(--c-orange)]/10 text-[#8a4a1f] rounded px-1 py-0.5 hover:bg-[var(--c-orange)]/20"
                  >
                    <Flag size={9} fill="currentColor" className="shrink-0" />
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
                {due.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onOpenTask(t)}
                    className="text-[11px] leading-tight text-left bg-black/5 text-[#4d574f] rounded px-1 py-0.5 hover:bg-black/10 truncate"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
