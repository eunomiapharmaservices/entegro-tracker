"use client";

import { useState } from "react";
import { Project, Resource, Status, STATUS_LABELS, STATUS_ORDER, Task } from "@/lib/types";
import TaskCard from "./TaskCard";

export default function KanbanBoard({
  tasks,
  resources,
  projects,
  onOpenTask,
  onMoveStatus,
}: {
  tasks: Task[];
  resources: Resource[];
  projects: Project[];
  onOpenTask: (task: Task) => void;
  onMoveStatus: (taskId: string, status: Status) => void;
}) {
  const topLevel = tasks.filter((t) => !t.parent_task_id);
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null);

  const resourceById = (id: string | null) =>
    resources.find((r) => r.id === id);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-full">
      {STATUS_ORDER.map((status) => {
        const columnTasks = topLevel.filter((t) => t.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(status);
            }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => {
              e.preventDefault();
              const taskId = e.dataTransfer.getData("text/task-id");
              if (taskId) onMoveStatus(taskId, status);
              setDragOverCol(null);
            }}
            className={`w-72 shrink-0 rounded-xl flex flex-col ${
              dragOverCol === status ? "bg-[var(--c-green)]/5 ring-2 ring-[var(--c-green)]/20" : ""
            }`}
          >
            <div className="flex items-center justify-between px-1 py-2">
              <h3 className="font-display text-sm font-semibold text-[#4d574f]">
                {STATUS_LABELS[status]}
              </h3>
              <span className="text-xs text-[#a39d8c] font-mono">
                {columnTasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 px-0.5 min-h-[60px]">
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  subtasks={tasks.filter((t) => t.parent_task_id === task.id)}
                  assignee={resourceById(task.assigned_to)}
                  onClick={() => onOpenTask(task)}
                  dragHandlers={{
                    draggable: true,
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
    </div>
  );
}
