"use client";

import { useState } from "react";
import { Project, Resource, Status, STATUS_LABELS, STATUS_ORDER, Task } from "@/lib/types";
import { daysSince } from "@/lib/dateUtils";
import TaskCard from "./TaskCard";

const DONE_VISIBLE_DAYS = 14;

// Matches "GCR_Support" or "GCR Support" (however it was typed/imported).
function isGcrSupport(task: Task): boolean {
  return (task.task_type || "").trim().toLowerCase().replace(/[\s_]+/g, "_") === "gcr_support";
}

function isVisibleOnBoard(task: Task): boolean {
  if (task.status !== "done") return true;
  const completedOn = task.actual_completion || task.updated_at.slice(0, 10);
  return daysSince(completedOn) <= DONE_VISIBLE_DAYS;
}

export default function KanbanBoard({
  tasks,
  resources,
  projects,
  onOpenTask,
  onMoveStatus,
  canEdit,
}: {
  tasks: Task[];
  resources: Resource[];
  projects: Project[];
  onOpenTask: (task: Task) => void;
  onMoveStatus: (taskId: string, status: Status) => void;
  canEdit: boolean;
}) {
  const topLevel = tasks.filter((t) => !t.parent_task_id && isVisibleOnBoard(t));
  const hiddenDoneCount = tasks.filter(
    (t) => !t.parent_task_id && t.status === "done" && !isVisibleOnBoard(t)
  ).length;
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null);

  const resourceById = (id: string | null) =>
    resources.find((r) => r.id === id);

  function assigneesFor(task: Task): Resource[] {
    const ids = task.assignee_ids?.length ? task.assignee_ids : task.assigned_to ? [task.assigned_to] : [];
    return ids.map((id) => resourceById(id)).filter((r): r is Resource => !!r);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
        {STATUS_ORDER.map((status) => {
          const columnTasks = topLevel.filter((t) => t.status === status);
          return (
            <div
              key={status}
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setDragOverCol(status);
              }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                const taskId = e.dataTransfer.getData("text/task-id");
                if (taskId) onMoveStatus(taskId, status);
                setDragOverCol(null);
              }}
              className={`w-72 shrink-0 rounded-xl flex flex-col h-full ${
                dragOverCol === status ? "bg-[var(--c-green)]/5 ring-2 ring-[var(--c-green)]/20" : ""
              }`}
            >
              <div className="flex items-center justify-between px-1 py-2 shrink-0">
                <h3 className="font-display text-sm font-semibold text-[#4d574f]">
                  {STATUS_LABELS[status]}
                </h3>
                <span className="text-xs text-[#a39d8c] font-mono">
                  {columnTasks.length}
                </span>
              </div>
              <div className="flex flex-col gap-2 px-0.5 flex-1 min-h-0 overflow-y-auto">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    subtasks={tasks.filter((t) => t.parent_task_id === task.id)}
                    assignees={assigneesFor(task)}
                    onClick={() => onOpenTask(task)}
                    dragHandlers={{
                      draggable: canEdit,
                      onDragStart: (e) =>
                        e.dataTransfer.setData("text/task-id", task.id),
                    }}
                  />
                ))}
                {columnTasks.length === 0 && (
                  <div className="text-xs text-[#c9c2b2] px-2 py-6 text-center border border-dashed border-[#e7e2d8] rounded-lg">
                    Nothing here
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* GCR Support — a cross-status lane pulling all matching tasks
            together for quick visibility, alongside (not instead of) their
            normal status column. Dragging a card from here into a status
            column still changes its status as usual. */}
        {(() => {
          const gcrTasks = topLevel.filter(isGcrSupport);
          return (
            <div className="w-72 shrink-0 rounded-xl flex flex-col h-full">
              <div className="flex items-center justify-between px-1 py-2 shrink-0">
                <h3 className="font-display text-sm font-semibold text-[#4d574f]">
                  GCR Support
                </h3>
                <span className="text-xs text-[#a39d8c] font-mono">{gcrTasks.length}</span>
              </div>
              <div className="flex flex-col gap-2 px-0.5 flex-1 min-h-0 overflow-y-auto">
                {gcrTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    subtasks={tasks.filter((t) => t.parent_task_id === task.id)}
                    assignees={assigneesFor(task)}
                    onClick={() => onOpenTask(task)}
                    statusBadge={STATUS_LABELS[task.status]}
                    dragHandlers={{
                      draggable: canEdit,
                      onDragStart: (e) =>
                        e.dataTransfer.setData("text/task-id", task.id),
                    }}
                  />
                ))}
                {gcrTasks.length === 0 && (
                  <div className="text-xs text-[#c9c2b2] px-2 py-6 text-center border border-dashed border-[#e7e2d8] rounded-lg">
                    Nothing here
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
      {hiddenDoneCount > 0 && (
        <p className="text-xs text-[#a39d8c] px-1 pt-1">
          {hiddenDoneCount} task{hiddenDoneCount === 1 ? "" : "s"} completed more than{" "}
          {DONE_VISIBLE_DAYS} days ago — still in the List view and other views, just off the board.
        </p>
      )}
    </div>
  );
}
