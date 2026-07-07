"use client";

import { Flag, ListChecks } from "lucide-react";
import { Resource, Task, PRIORITY_COLORS } from "@/lib/types";
import { fmt, isOverdue } from "@/lib/dateUtils";
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
  const overdue = isOverdue(task.due_date, task.status);

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

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2 text-xs text-[#8a8578]">
          {task.due_date && (
            <span className={overdue ? "text-[#C23B3B] font-medium" : ""}>
              {fmt(task.due_date)}
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
