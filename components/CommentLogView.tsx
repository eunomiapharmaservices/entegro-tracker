"use client";

import { useMemo, useState } from "react";
import { Search, RotateCcw } from "lucide-react";
import { Task, TaskComment } from "@/lib/types";

export default function CommentLogView({
  taskComments,
  tasks,
  onOpenTask,
  onRestoreTask,
}: {
  taskComments: TaskComment[];
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onRestoreTask: (id: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<"comments" | "deleted">("comments");
  const [search, setSearch] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

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

  const deletedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.deleted_at && !t.parent_task_id)
        .sort((a, b) => new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime()),
    [tasks]
  );

  const filteredDeleted = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deletedTasks;
    return deletedTasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [deletedTasks, search]);

  async function handleRestore(id: string) {
    setRestoringId(id);
    try {
      await onRestoreTask(id);
    } catch (err) {
      alert(`Couldn't restore this task: ${(err as Error).message || "unknown error"}`);
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--c-line)] bg-white h-full flex flex-col">
      <div className="px-4 pt-3 flex gap-1 border-b border-[var(--c-line)]">
        {(["comments", "deleted"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-[var(--c-green)] text-[var(--c-green)]"
                : "border-transparent text-[#8a8578] hover:text-[var(--c-ink)]"
            }`}
          >
            {t === "comments" ? "Comments" : `Deleted tasks${deletedTasks.length ? ` (${deletedTasks.length})` : ""}`}
          </button>
        ))}
      </div>

      <div className="p-4 border-b border-[var(--c-line)]">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a39d8c]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "comments" ? "Search comments, people, tasks…" : "Search deleted tasks…"}
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-[var(--c-line)] bg-white text-sm outline-none focus:border-[var(--c-green)]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "comments" ? (
          filtered.length === 0 ? (
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
          )
        ) : filteredDeleted.length === 0 ? (
          <p className="text-sm text-[#a39d8c] text-center py-10">
            {deletedTasks.length === 0 ? "No deleted tasks." : "No deleted tasks match that search."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredDeleted.map((t) => (
              <div
                key={t.id}
                className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2.5 flex items-center justify-between gap-3"
              >
                <button
                  onClick={() => onOpenTask(t)}
                  className="text-left flex-1 min-w-0 hover:opacity-70"
                >
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <p className="text-[11px] text-[#a39d8c] font-mono mt-0.5">
                    Deleted{" "}
                    {new Date(t.deleted_at!).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </button>
                <button
                  onClick={() => handleRestore(t.id)}
                  disabled={restoringId === t.id}
                  className="shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-[var(--c-line)] text-[var(--c-green)] hover:bg-[var(--c-green)]/5 disabled:opacity-50"
                >
                  <RotateCcw size={12} />
                  {restoringId === t.id ? "Restoring…" : "Restore"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

