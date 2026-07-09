"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Task, TaskComment } from "@/lib/types";

export default function CommentLogView({
  taskComments,
  tasks,
  onOpenTask,
}: {
  taskComments: TaskComment[];
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}) {
  const [search, setSearch] = useState("");

  function taskFor(taskId: string) {
    return tasks.find((t) => t.id === taskId);
  }

  const sorted = useMemo(
    () =>
      [...taskComments].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [taskComments]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) => {
      const task = taskFor(c.task_id);
      return (
        c.body.toLowerCase().includes(q) ||
        (c.author || "").toLowerCase().includes(q) ||
        (task?.title || "").toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, search, tasks]);

  return (
    <div className="rounded-xl border border-[var(--c-line)] bg-white h-full flex flex-col">
      <div className="p-4 border-b border-[var(--c-line)]">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a39d8c]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search comments, people, tasks…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-[var(--c-line)] bg-white text-sm outline-none focus:border-[var(--c-green)]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-[#a39d8c] text-center py-10">
            {taskComments.length === 0 ? "No comments yet." : "No comments match that search."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((c) => {
              const task = taskFor(c.task_id);
              return (
                <button
                  key={c.id}
                  onClick={() => task && onOpenTask(task)}
                  disabled={!task}
                  className="w-full text-left rounded-lg border border-[var(--c-line)] px-3 py-2.5 hover:bg-black/[0.02] disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-xs font-medium text-[#4d574f] truncate">
                      {task ? task.title : "(task no longer exists)"}
                    </span>
                    <span className="text-[10px] text-[#a39d8c] font-mono shrink-0">
                      {new Date(c.created_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm">
                    {c.author && (
                      <span className="font-medium text-[var(--c-green)]">{c.author}: </span>
                    )}
                    {c.body}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
