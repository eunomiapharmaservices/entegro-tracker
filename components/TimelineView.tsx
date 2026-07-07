"use client";

import { useMemo } from "react";
import { Flag } from "lucide-react";
import { Resource, Task, PRIORITY_COLORS } from "@/lib/types";
import { addDays, daysBetween, fmt, isoDate, MONTH_NAMES } from "@/lib/dateUtils";
import Avatar from "./Avatar";

const DAY_WIDTH = 30;
const ROW_HEIGHT = 40;

export default function TimelineView({
  tasks,
  resources,
  onOpenTask,
}: {
  tasks: Task[];
  resources: Resource[];
  onOpenTask: (task: Task) => void;
}) {
  const topLevel = tasks.filter((t) => !t.parent_task_id);

  const { rangeStart, days } = useMemo(() => {
    const allDates: string[] = [];
    tasks.forEach((t) => {
      if (t.start_date) allDates.push(t.start_date);
      if (t.due_date) allDates.push(t.due_date);
      if (t.milestone_date) allDates.push(t.milestone_date);
    });
    let min: Date, max: Date;
    if (allDates.length === 0) {
      min = addDays(new Date(), -7);
      max = addDays(new Date(), 30);
    } else {
      const sorted = allDates.sort();
      min = addDays(new Date(sorted[0] + "T00:00:00"), -4);
      max = addDays(new Date(sorted[sorted.length - 1] + "T00:00:00"), 7);
    }
    const totalDays = Math.max(21, daysBetween(isoDate(min), isoDate(max)));
    return { rangeStart: min, days: totalDays };
  }, [tasks]);

  const todayOffset = daysBetween(isoDate(rangeStart), isoDate(new Date()));

  // Build month header segments
  const monthSegments: { label: string; span: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(rangeStart, i);
    const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    const last = monthSegments[monthSegments.length - 1];
    if (last && last.label === label) last.span += 1;
    else monthSegments.push({ label, span: 1 });
  }

  // Per-day cells for the date sub-header row
  const dayCells = Array.from({ length: days }, (_, i) => {
    const d = addDays(rangeStart, i);
    return { date: d, isWeekend: d.getDay() === 0 || d.getDay() === 6, isToday: isoDate(d) === isoDate(new Date()) };
  });

  const resourceById = (id: string | null) => resources.find((r) => r.id === id);

  function barStyle(start: string | null, end: string | null) {
    const s = start || end;
    const e = end || start;
    if (!s || !e) return null;
    const offset = Math.max(0, daysBetween(isoDate(rangeStart), s));
    const span = Math.max(1, daysBetween(s, e) + 1);
    return { left: offset * DAY_WIDTH, width: span * DAY_WIDTH };
  }

  return (
    <div className="overflow-auto h-full rounded-xl border border-[var(--c-line)] bg-white">
      <div style={{ width: 220 + days * DAY_WIDTH, minWidth: "100%" }}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-[var(--c-line)]">
          <div className="flex">
            <div className="w-[220px] shrink-0 border-r border-[var(--c-line)] px-3 py-2 text-xs font-medium text-[#8a8578] font-display">
              TASK
            </div>
            <div className="flex">
              {monthSegments.map((seg, i) => (
                <div
                  key={i}
                  style={{ width: seg.span * DAY_WIDTH }}
                  className="text-xs font-medium text-[#8a8578] px-2 py-1.5 border-r border-[var(--c-line)] font-display"
                >
                  {seg.label}
                </div>
              ))}
            </div>
          </div>
          <div className="flex border-t border-[var(--c-line)]">
            <div className="w-[220px] shrink-0 border-r border-[var(--c-line)]" />
            <div className="flex">
              {dayCells.map((c, i) => (
                <div
                  key={i}
                  style={{ width: DAY_WIDTH }}
                  className={`text-[10px] text-center font-mono py-1 border-r border-[var(--c-line)]/50 ${
                    c.isToday
                      ? "bg-[var(--c-orange)]/10 text-[var(--c-orange)] font-semibold"
                      : c.isWeekend
                      ? "bg-black/[0.02] text-[#c9c2b2]"
                      : "text-[#a39d8c]"
                  }`}
                >
                  {c.date.getDate()}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rows */}
        <div className="relative">
          {/* Weekend column shading */}
          {dayCells.map(
            (c, i) =>
              c.isWeekend && (
                <div
                  key={`wk-${i}`}
                  className="absolute top-0 bottom-0 bg-black/[0.015] pointer-events-none"
                  style={{ left: 220 + i * DAY_WIDTH, width: DAY_WIDTH }}
                />
              )
          )}
          {/* Today marker */}
          {todayOffset >= 0 && todayOffset <= days && (
            <div
              className="absolute top-0 bottom-0 w-px bg-[var(--c-orange)] z-[5]"
              style={{ left: 220 + todayOffset * DAY_WIDTH }}
            />
          )}

          {topLevel.map((task) => {
            const subtasks = tasks.filter((t) => t.parent_task_id === task.id);
            const rows = [task, ...subtasks];
            return (
              <div key={task.id}>
                {rows.map((row, idx) => {
                  const isSub = idx > 0;
                  const bar = barStyle(row.start_date, row.due_date);
                  const assignee = resourceById(row.assigned_to);
                  return (
                    <div
                      key={row.id}
                      className="flex border-b border-[var(--c-line)] hover:bg-black/[0.015]"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div
                        className={`w-[220px] shrink-0 border-r border-[var(--c-line)] px-3 flex items-center gap-2 text-sm cursor-pointer ${
                          isSub ? "pl-7 text-[#6b7570]" : "font-medium"
                        }`}
                        onClick={() => onOpenTask(row)}
                        title={row.title}
                      >
                        {row.is_milestone && (
                          <Flag size={11} className="text-[var(--c-orange)] shrink-0" fill="currentColor" />
                        )}
                        <span className="truncate">{row.title}</span>
                      </div>
                      <div className="relative flex-1" style={{ height: ROW_HEIGHT }}>
                        {row.is_milestone && row.milestone_date ? (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rotate-45 w-3 h-3 bg-[var(--c-orange)] cursor-pointer"
                            style={{
                              left:
                                Math.max(0, daysBetween(isoDate(rangeStart), row.milestone_date)) *
                                  DAY_WIDTH +
                                DAY_WIDTH / 2,
                            }}
                            onClick={() => onOpenTask(row)}
                            title={`${row.title} — ${fmt(row.milestone_date)}`}
                          />
                        ) : bar ? (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 h-5 rounded-md flex items-center px-1.5 cursor-pointer"
                            style={{
                              left: bar.left,
                              width: bar.width,
                              background: isSub ? "#DCE6E1" : PRIORITY_COLORS[row.priority] + "cc",
                            }}
                            onClick={() => onOpenTask(row)}
                          >
                            {assignee && (
                              <span className="scale-90 origin-left">
                                <Avatar resource={assignee} size={16} />
                              </span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {topLevel.length === 0 && (
            <div className="p-10 text-center text-sm text-[#a39d8c]">
              No tasks yet — add one to see it on the timeline.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
