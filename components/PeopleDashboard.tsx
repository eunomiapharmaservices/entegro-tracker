"use client";

import { Flag } from "lucide-react";
import { Project, Resource, STATUS_LABELS, Task } from "@/lib/types";
import { fmt, isOverdue, effectiveDueDate } from "@/lib/dateUtils";
import { useViewOnlyEmails } from "@/lib/useViewOnlyEmails";
import Avatar from "./Avatar";
import TaskTitle from "./TaskTitle";

const STATUS_DOT: Record<string, string> = {
  todo: "#a39d8c",
  in_progress: "#3B6E8F",
  on_hold: "#E07A3E",
  review: "#8A5FB0",
  done: "#1F5C4A",
};

export default function PeopleDashboard({
  resources,
  projects,
  tasks,
  onOpenTask,
}: {
  resources: Resource[];
  projects: Project[];
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}) {
  const { isViewOnlyResource } = useViewOnlyEmails();
  // View Only accounts aren't part of the assignable workforce — no point
  // showing an empty workload card for them here.
  const workingResources = resources.filter((r) => !isViewOnlyResource(r));

  const projectById = (id: string | null) => projects.find((p) => p.id === id);

  function tasksFor(resourceId: string) {
    return tasks.filter(
      (t) =>
        t.status !== "done" &&
        (t.assignee_ids?.length ? t.assignee_ids.includes(resourceId) : t.assigned_to === resourceId)
    );
  }

  function groupByProject(personTasks: Task[]) {
    const groups = new Map<string, { project: Project | null; tasks: Task[] }>();
    for (const t of personTasks) {
      const key = t.project_id || "none";
      if (!groups.has(key)) {
        groups.set(key, { project: projectById(t.project_id), tasks: [] });
      }
      groups.get(key)!.tasks.push(t);
    }
    return Array.from(groups.values()).sort((a, b) =>
      (a.project?.name || "zzz").localeCompare(b.project?.name || "zzz")
    );
  }

  const unassigned = tasks.filter(
    (t) => t.status !== "done" && !t.assigned_to && !t.assignee_ids?.length
  );

  return (
    <div className="overflow-y-auto h-full pr-1">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {workingResources.map((r) => {
          const personTasks = tasksFor(r.id);
          const overdue = personTasks.filter((t) =>
            isOverdue(effectiveDueDate(t.due_date, t.status, t.hold_started_at), t.status)
          ).length;
          const groups = groupByProject(personTasks);

          return (
            <div
              key={r.id}
              className="rounded-xl border border-[var(--c-line)] bg-white p-4 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <Avatar resource={r} size={32} />
                <div className="min-w-0">
                  <p className="font-display font-semibold text-sm truncate">{r.name}</p>
                  <p className="text-xs text-[#8a8578]">
                    {personTasks.length} active task{personTasks.length === 1 ? "" : "s"}
                    {overdue > 0 && (
                      <span className="text-[#C23B3B] font-medium"> · {overdue} overdue</span>
                    )}
                  </p>
                </div>
              </div>

              {groups.length === 0 ? (
                <p className="text-xs text-[#c9c2b2]">No tasks assigned.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {groups.map((g) => (
                    <div key={g.project?.id || "none"}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {g.project && (
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: g.project.color }}
                          />
                        )}
                        <span className="text-xs font-medium text-[#4d574f] font-display">
                          {g.project ? g.project.name : "No project"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {g.tasks.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => onOpenTask(t)}
                            className="flex items-center gap-2 text-left px-2 py-1.5 rounded-md hover:bg-black/[0.03] text-sm"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: STATUS_DOT[t.status] }}
                              title={STATUS_LABELS[t.status]}
                            />
                            {t.is_milestone && (
                              <Flag
                                size={10}
                                className="text-[var(--c-orange)] shrink-0"
                                fill="currentColor"
                              />
                            )}
                            <span className="truncate flex-1"><TaskTitle task={t} /></span>
                            {t.progress_percent > 0 && t.progress_percent < 100 && (
                              <span className="text-[11px] text-[#8a8578] font-mono shrink-0">
                                {t.progress_percent}%
                              </span>
                            )}
                            {t.due_date && (
                              <span
                                className={`text-[11px] shrink-0 ${
                                  isOverdue(effectiveDueDate(t.due_date, t.status, t.hold_started_at), t.status)
                                    ? "text-[#C23B3B] font-medium"
                                    : "text-[#a39d8c]"
                                }`}
                              >
                                {fmt(effectiveDueDate(t.due_date, t.status, t.hold_started_at))}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {workingResources.length === 0 && (
          <p className="text-sm text-[#a39d8c] col-span-full text-center py-10">
            No people added yet — use the + next to "People" in the sidebar.
          </p>
        )}
      </div>

      {unassigned.length > 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--c-line)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#8a8578] mb-2 font-display">
            Unassigned ({unassigned.length})
          </p>
          <div className="flex flex-col gap-1">
            {unassigned.map((t) => (
              <button
                key={t.id}
                onClick={() => onOpenTask(t)}
                className="flex items-center gap-2 text-left px-2 py-1.5 rounded-md hover:bg-black/[0.03] text-sm"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: STATUS_DOT[t.status] }}
                />
                <span className="truncate flex-1"><TaskTitle task={t} /></span>
                {t.due_date && (
                  <span className="text-[11px] text-[#a39d8c] shrink-0">
                    {fmt(effectiveDueDate(t.due_date, t.status, t.hold_started_at))}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
