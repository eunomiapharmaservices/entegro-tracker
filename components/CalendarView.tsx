"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flag, Download } from "lucide-react";
import { Resource, Task } from "@/lib/types";
import {
  addDays,
  endOfMonth,
  isoDate,
  MONTH_NAMES,
  startOfMonth,
  WEEKDAY_SHORT,
} from "@/lib/dateUtils";
import { downloadCSV } from "@/lib/csvImport";

type CalMode = "month" | "week" | "day";

function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return addDays(d, -day);
}

type TasksOnDayFn = (iso: string) => { milestones: Task[]; due: Task[]; starting: Task[] };

export default function CalendarView({
  tasks,
  resources,
  onOpenTask,
}: {
  tasks: Task[];
  resources: Resource[];
  onOpenTask: (task: Task) => void;
}) {
  const [cursor, setCursor] = useState(new Date());
  const [mode, setMode] = useState<CalMode>("month");
  const today = isoDate(new Date());

  function tasksOnDay(iso: string) {
    const milestones = tasks.filter((t) => t.is_milestone && t.milestone_date === iso);
    const due = tasks.filter((t) => !t.is_milestone && t.due_date === iso);
    const starting = tasks.filter((t) => !t.is_milestone && t.start_date === iso);
    return { milestones, due, starting };
  }

  function resourceName(id: string | null) {
    return resources.find((r) => r.id === id)?.name || null;
  }

  function navigate(direction: -1 | 1) {
    if (mode === "month") {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1));
    } else if (mode === "week") {
      setCursor(addDays(cursor, direction * 7));
    } else {
      setCursor(addDays(cursor, direction));
    }
  }

  const { rangeStart, rangeEnd, label } = useMemo(() => {
    if (mode === "month") {
      const s = startOfMonth(cursor);
      const e = endOfMonth(cursor);
      return {
        rangeStart: s,
        rangeEnd: e,
        label: `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`,
      };
    }
    if (mode === "week") {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      const sameMonth = s.getMonth() === e.getMonth();
      const label = sameMonth
        ? `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
        : `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
      return { rangeStart: s, rangeEnd: e, label };
    }
    return {
      rangeStart: cursor,
      rangeEnd: cursor,
      label: cursor.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    };
  }, [mode, cursor]);

  function handleExport() {
    const rows: string[] = ["date,type,title,status,priority,assignee,site"];
    let d = new Date(rangeStart);
    while (d <= rangeEnd) {
      const iso = isoDate(d);
      const { milestones, due } = tasksOnDay(iso);
      for (const t of [...milestones, ...due]) {
        const type = t.is_milestone ? "milestone" : "due";
        const assignee = resourceName(t.assigned_to) || "";
        const site = [t.site_name, t.eid].filter(Boolean).join(" #");
        const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
        rows.push(
          [iso, type, esc(t.title), t.status, t.priority, esc(assignee), esc(site)].join(",")
        );
      }
      d = addDays(d, 1);
    }
    const filename = `calendar-${mode}-${isoDate(rangeStart)}.csv`;
    downloadCSV(filename, rows.join("\n"));
  }

  return (
    <div className="rounded-xl border border-[var(--c-line)] bg-white p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display font-semibold text-lg">{label}</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-black/[0.03] rounded-lg p-0.5">
            {(["month", "week", "day"] as CalMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-xs px-2.5 py-1 rounded-md capitalize transition-colors ${
                  mode === m
                    ? "bg-white shadow-sm font-medium text-[var(--c-ink)]"
                    : "text-[#8a8578] hover:text-[var(--c-ink)]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-md hover:bg-black/5">
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCursor(new Date())}
              className="text-xs px-2.5 py-1 rounded-md hover:bg-black/5 text-[#4d574f]"
            >
              Today
            </button>
            <button onClick={() => navigate(1)} className="p-1.5 rounded-md hover:bg-black/5">
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-[var(--c-line)] hover:bg-black/5"
          >
            <Download size={13} />
            Export
          </button>
        </div>
      </div>

      {mode === "month" && (
        <MonthGrid cursor={cursor} today={today} tasksOnDay={tasksOnDay} onOpenTask={onOpenTask} />
      )}
      {mode === "week" && (
        <WeekGrid
          rangeStart={rangeStart}
          today={today}
          tasksOnDay={tasksOnDay}
          onOpenTask={onOpenTask}
        />
      )}
      {mode === "day" && (
        <DayAgenda
          cursor={cursor}
          today={today}
          tasksOnDay={tasksOnDay}
          onOpenTask={onOpenTask}
          resourceName={resourceName}
        />
      )}
    </div>
  );
}

function MonthGrid({
  cursor,
  today,
  tasksOnDay,
  onOpenTask,
}: {
  cursor: Date;
  today: string;
  tasksOnDay: TasksOnDayFn;
  onOpenTask: (t: Task) => void;
}) {
  const first = startOfMonth(cursor);
  const last = endOfMonth(cursor);
  const startOffset = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + last.getDate()) / 7) * 7;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > last.getDate()) cells.push(null);
    else cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), dayNum));
  }

  return (
    <>
      <div className="grid grid-cols-7 text-xs font-medium text-[#8a8578] mb-1 font-display">
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} className="px-2 py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="rounded-lg bg-transparent" />;
          const iso = isoDate(d);
          const { milestones, due } = tasksOnDay(iso);
          const isToday = iso === today;
          return (
            <div
              key={i}
              className={`rounded-lg border p-1.5 flex flex-col gap-1 min-h-[80px] overflow-hidden ${
                isToday
                  ? "border-[var(--c-green)] bg-[var(--c-green)]/[0.04]"
                  : "border-[var(--c-line)]"
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
    </>
  );
}

function WeekGrid({
  rangeStart,
  today,
  tasksOnDay,
  onOpenTask,
}: {
  rangeStart: Date;
  today: string;
  tasksOnDay: TasksOnDayFn;
  onOpenTask: (t: Task) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i));

  return (
    <div className="grid grid-cols-7 gap-2 flex-1">
      {days.map((d) => {
        const iso = isoDate(d);
        const { milestones, due } = tasksOnDay(iso);
        const isToday = iso === today;
        return (
          <div
            key={iso}
            className={`rounded-lg border p-2 flex flex-col gap-1.5 overflow-hidden ${
              isToday
                ? "border-[var(--c-green)] bg-[var(--c-green)]/[0.04]"
                : "border-[var(--c-line)]"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-medium text-[#8a8578] font-display">
                {WEEKDAY_SHORT[(d.getDay() + 6) % 7]}
              </span>
              <span
                className={`text-sm font-mono ${
                  isToday ? "text-[var(--c-green)] font-semibold" : "text-[#a39d8c]"
                }`}
              >
                {d.getDate()}
              </span>
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto">
              {milestones.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onOpenTask(t)}
                  className="flex items-center gap-1 text-[11px] leading-tight text-left bg-[var(--c-orange)]/10 text-[#8a4a1f] rounded px-1.5 py-1 hover:bg-[var(--c-orange)]/20"
                >
                  <Flag size={9} fill="currentColor" className="shrink-0" />
                  <span className="truncate">{t.title}</span>
                </button>
              ))}
              {due.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onOpenTask(t)}
                  className="text-[11px] leading-tight text-left bg-black/5 text-[#4d574f] rounded px-1.5 py-1 hover:bg-black/10 truncate"
                >
                  {t.title}
                </button>
              ))}
              {milestones.length === 0 && due.length === 0 && (
                <span className="text-[10px] text-[#c9c2b2]">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayAgenda({
  cursor,
  today,
  tasksOnDay,
  onOpenTask,
  resourceName,
}: {
  cursor: Date;
  today: string;
  tasksOnDay: TasksOnDayFn;
  onOpenTask: (t: Task) => void;
  resourceName: (id: string | null) => string | null;
}) {
  const iso = isoDate(cursor);
  const { milestones, due, starting } = tasksOnDay(iso);
  const isToday = iso === today;
  const rows: { task: Task; kind: string }[] = [
    ...milestones.map((task) => ({ task, kind: "Milestone" })),
    ...due.map((task) => ({ task, kind: "Due" })),
    ...starting.map((task) => ({ task, kind: "Starts" })),
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      {isToday && <p className="text-xs text-[var(--c-green)] font-medium mb-3">Today</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-[#c9c2b2] py-10 text-center">
          Nothing scheduled for this day.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(({ task, kind }, i) => (
            <button
              key={`${task.id}-${kind}-${i}`}
              onClick={() => onOpenTask(task)}
              className="w-full flex items-center gap-3 text-left rounded-lg border border-[var(--c-line)] px-3 py-2.5 hover:bg-black/[0.02]"
            >
              <span
                className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                  kind === "Milestone"
                    ? "bg-[var(--c-orange)]/10 text-[#8a4a1f]"
                    : kind === "Due"
                    ? "bg-black/5 text-[#4d574f]"
                    : "bg-[var(--c-green)]/10 text-[var(--c-green)]"
                }`}
              >
                {kind}
              </span>
              <span className="text-sm flex-1 truncate">{task.title}</span>
              {resourceName(task.assigned_to) && (
                <span className="text-xs text-[#8a8578] shrink-0">
                  {resourceName(task.assigned_to)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
