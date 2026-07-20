"use client";

import { Flag, ListChecks, Snowflake } from "lucide-react";
import { Resource, Task, PRIORITY_COLORS } from "@/lib/types";
import { fmt, isOverdue, effectiveDueDate } from "@/lib/dateUtils";
import TaskTitle from "./TaskTitle";
import Avatar from "./Avatar";

export default function TaskCard({
  task,
  subtasks,
  assignees,
  onClick,
  dragHandlers,
  statusBadge,
}: {
  task: Task;
  subtasks: Task[];
  assignees: Resource[];
  onClick: () => void;
  dragHandlers?: {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
  };
  statusBadge?: string;
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
      {statusBadge && (
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 text-[#4d574f] mb-1.5">
          {statusBadge}
        </span>
      )}
      <p className="text-sm font-medium leading-snug text-[var(--c-ink)]">
        <TaskTitle task={task} />
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
            <span
              className={overdue ? "text-[#C23B3B] font-medium" : ""}
              title={
                extended
                  ? "Extended while On Hold"
                  : task.status === "review"
                  ? "Frozen while In Review"
                  : undefined
              }
            >
              {fmt(dueDate)}
              {extended && <span className="text-[var(--c-orange)]"> ⏳</span>}
              {!extended && task.status === "review" && (
                <Snowflake size={11} className="inline ml-1 -mt-0.5 text-[#3B6E8F]" />
              )}
            </span>
          )}
          {subtasks.length > 0 && (
            <span className="flex items-center gap-1">
              <ListChecks size={12} />
              {done}/{subtasks.length}
            </span>
          )}
        </div>
        <div className="flex items-center -space-x-1.5">
          {assignees.length === 0 ? (
            <Avatar resource={undefined} size={22} />
          ) : (
            <>
              {assignees.slice(0, 3).map((a) => (
                <div key={a.id} className="ring-2 ring-white rounded-full">
                  <Avatar resource={a} size={22} />
                </div>
              ))}
              {assignees.length > 3 && (
                <div
                  className="ring-2 ring-white rounded-full bg-black/10 text-[#4d574f] flex items-center justify-center font-display font-medium"
                  style={{ width: 22, height: 22, fontSize: 9 }}
                >
                  +{assignees.length - 3}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
