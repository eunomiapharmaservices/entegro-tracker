"use client";

import { useEffect, useState } from "react";
import { Flag, Plus, Trash2, X } from "lucide-react";
import {
  PRIORITY_LABELS,
  Priority,
  Project,
  Resource,
  STATUS_LABELS,
  STATUS_ORDER,
  Status,
  Task,
} from "@/lib/types";
import Avatar from "./Avatar";

interface Props {
  task: Task | null; // null = creating a new top-level task
  defaultProjectId: string | null;
  tasks: Task[];
  resources: Resource[];
  projects: Project[];
  onClose: () => void;
  onCreate: (input: Partial<Task>) => Promise<Task>;
  onUpdate: (id: string, input: Partial<Task>) => Promise<Task>;
  onDelete: (id: string) => Promise<void>;
}

export default function TaskModal({
  task,
  defaultProjectId,
  tasks,
  resources,
  projects,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const isNew = !task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [projectId, setProjectId] = useState<string | null>(
    task?.project_id ?? defaultProjectId
  );
  const [assignedTo, setAssignedTo] = useState<string | null>(task?.assigned_to ?? null);
  const [status, setStatus] = useState<Status>(task?.status ?? "todo");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [startDate, setStartDate] = useState(task?.start_date ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [isMilestone, setIsMilestone] = useState(task?.is_milestone ?? false);
  const [milestoneDate, setMilestoneDate] = useState(task?.milestone_date ?? "");
  const [saving, setSaving] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [savedTaskId, setSavedTaskId] = useState<string | null>(task?.id ?? null);

  const subtasks = savedTaskId
    ? tasks.filter((t) => t.parent_task_id === savedTaskId)
    : [];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    const payload: Partial<Task> = {
      title: title.trim(),
      description: description.trim() || null,
      project_id: projectId,
      assigned_to: assignedTo,
      status,
      priority,
      start_date: startDate || null,
      due_date: dueDate || null,
      is_milestone: isMilestone,
      milestone_date: isMilestone ? milestoneDate || null : null,
    };
    try {
      if (savedTaskId) {
        await onUpdate(savedTaskId, payload);
      } else {
        const created = await onCreate(payload);
        setSavedTaskId(created.id);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSubtask() {
    if (!newSubtaskTitle.trim()) return;
    let parentId = savedTaskId;
    if (!parentId) {
      // Auto-save parent first so the subtask has something to attach to
      const created = await onCreate({
        title: title.trim() || "Untitled task",
        description: description.trim() || null,
        project_id: projectId,
        assigned_to: assignedTo,
        status,
        priority,
        start_date: startDate || null,
        due_date: dueDate || null,
        is_milestone: isMilestone,
        milestone_date: isMilestone ? milestoneDate || null : null,
      });
      parentId = created.id;
      setSavedTaskId(created.id);
    }
    await onCreate({
      title: newSubtaskTitle.trim(),
      parent_task_id: parentId,
      project_id: projectId,
      status: "todo",
      priority: "medium",
    });
    setNewSubtaskTitle("");
  }

  async function handleDelete() {
    if (!savedTaskId) {
      onClose();
      return;
    }
    if (!confirm("Delete this task and all its subtasks?")) return;
    await onDelete(savedTaskId);
    onClose();
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm bg-white focus:border-[var(--c-green)] outline-none";
  const labelCls = "text-xs font-medium text-[#8a8578] mb-1 block font-display";

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 overflow-y-auto py-10"
      onClick={onClose}
    >
      <div
        className="bg-[var(--c-cream)] rounded-2xl w-full max-w-lg shadow-2xl border border-[var(--c-line)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="font-display font-semibold text-base">
            {isNew ? "New task" : "Edit task"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-4">
          <div>
            <input
              className="w-full text-lg font-medium bg-transparent border-b border-[var(--c-line)] pb-2 outline-none focus:border-[var(--c-green)]"
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <textarea
            className={inputCls + " min-h-[60px] resize-none"}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select
                className={inputCls}
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select
                className={inputCls}
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Assigned to</label>
              <select
                className={inputCls}
                value={assignedTo ?? ""}
                onChange={(e) => setAssignedTo(e.target.value || null)}
              >
                <option value="">Unassigned</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Project</label>
              <select
                className={inputCls}
                value={projectId ?? ""}
                onChange={(e) => setProjectId(e.target.value || null)}
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Start date</label>
              <input
                type="date"
                className={inputCls}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Due date</label>
              <input
                type="date"
                className={inputCls}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border border-[var(--c-line)] px-3 py-2.5 bg-white">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isMilestone}
                onChange={(e) => setIsMilestone(e.target.checked)}
                className="accent-[var(--c-orange)]"
              />
              <Flag size={13} className="text-[var(--c-orange)]" />
              This task marks a milestone
            </label>
            {isMilestone && (
              <input
                type="date"
                className={inputCls + " mt-2"}
                value={milestoneDate}
                onChange={(e) => setMilestoneDate(e.target.value)}
                placeholder="Milestone date"
              />
            )}
          </div>

          {/* Subtasks */}
          <div>
            <label className={labelCls}>Subtasks</label>
            <div className="flex flex-col gap-1.5 mb-2">
              {subtasks.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center gap-2 bg-white border border-[var(--c-line)] rounded-lg px-2.5 py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={st.status === "done"}
                    onChange={(e) =>
                      onUpdate(st.id, { status: e.target.checked ? "done" : "todo" })
                    }
                    className="accent-[var(--c-green)]"
                  />
                  <span
                    className={`text-sm flex-1 ${
                      st.status === "done" ? "line-through text-[#a39d8c]" : ""
                    }`}
                  >
                    {st.title}
                  </span>
                  <Avatar resource={resources.find((r) => r.id === st.assigned_to)} size={20} />
                  <button
                    onClick={() => onDelete(st.id)}
                    className="text-[#c9c2b2] hover:text-[#C23B3B]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="Add a subtask and press Enter"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
              />
              <button
                onClick={handleAddSubtask}
                className="shrink-0 rounded-lg border border-[var(--c-line)] px-3 hover:bg-black/5"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleDelete}
              className="text-sm text-[#C23B3B] hover:underline flex items-center gap-1"
            >
              <Trash2 size={13} />
              Delete task
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="text-sm px-4 py-2 rounded-lg hover:bg-black/5"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleSave();
                  onClose();
                }}
                disabled={saving || !title.trim()}
                className="text-sm px-4 py-2 rounded-lg bg-[var(--c-green)] text-white font-medium hover:bg-[#194a3b] disabled:opacity-50"
              >
                {saving ? "Saving…" : isNew ? "Create task" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
