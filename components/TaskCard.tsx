"use client";

import { Flag, ListChecks } from "lucide-react";
import { Resource, Task, PRIORITY_COLORS } from "@/lib/types";
import { fmt, isOverdue, effectiveDueDate } from "@/lib/dateUtils";
import Avatar from "./Avatar";

export default function TaskCard({
  task,
  subtasks,
  assignee,
  onClick,
  dragHandlers,
}: {
  task: Task;
  subtasks: Task[];
  assignee: Resource | undefined;
  onClick: () => void;
  dragHandlers?: {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
  };
}) {
  const done = subtasks.filter((s) => s.status === "done").length;
  const dueDate = effectiveDueDate(task.due_date, task.status, task.hold_started_at);
  const extended = dueDate !== task.due_date;
  const overdue = isOverdue(dueDate, task.status);

  return (
    <div
      onClick={onClick}
      draggable={dragHandlers?.draggable}
      onDragStart={dragHandlers?.onDragStart}
      className="group bg-white rounded-lg border border-[var(--c-line)] p-3 cursor-pointer hover:shadow-[0_2px_10px_rgba(26,36,32,0.08)] hover:-translate-y-[1px] transition-all"
      style={{ borderLeft: `3px solid ${PRIORITY_COLORS[task.priority]}` }}
    >
      {task.is_milestone && (
        <div className="flex items-center gap-1 text-[var(--c-orange)] text-[11px] font-medium mb-1.5">
          <Flag size={11} fill="currentColor" />
          MILESTONE
        </div>
      )}
      <p className="text-sm font-medium leading-snug text-[var(--c-ink)]">
        {task.title}
      </p>

      {(task.site_name || task.eid || task.task_type) && (
        <p className="text-[11px] text-[#8a8578] mt-1 truncate">
          {[task.task_type, task.site_name, task.eid ? `#${task.eid}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {task.progress_percent > 0 && task.progress_percent < 100 && (
        <div className="h-1 rounded-full bg-black/[0.06] mt-2 overflow-hidden">
          <div
            className="h-full bg-[var(--c-green-light)]"
            style={{ width: `${task.progress_percent}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2 text-xs text-[#8a8578]">
          {task.due_date && (
            <span className={overdue ? "text-[#C23B3B] font-medium" : ""} title={extended ? "Extended while On Hold/In Review" : undefined}>
              {fmt(dueDate)}
              {extended && <span className="text-[var(--c-orange)]"> ⏳</span>}
            </span>
          )}
          {subtasks.length > 0 && (
            <span className="flex items-center gap-1">
              <ListChecks size={12} />
              {done}/{subtasks.length}
            </span>
          )}
        </div>
        <Avatar resource={assignee} size={22} />
      </div>
    </div>
  );
}
