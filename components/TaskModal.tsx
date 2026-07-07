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
  TASK_TYPE_SUGGESTIONS,
  projectNameForSite,
} from "@/lib/types";
import Avatar from "./Avatar";
import { colorForIndex } from "@/lib/csvImport";

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
  createProject: (name: string, color: string) => Promise<Project>;
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
  createProject,
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

  // Network/ops tracker fields
  const [taskType, setTaskType] = useState(task?.task_type ?? "");
  const [eid, setEid] = useState(task?.eid ?? "");
  const [siteName, setSiteName] = useState(task?.site_name ?? "");
  const [raisedBy, setRaisedBy] = useState(task?.raised_by ?? "");
  const [dateAdded, setDateAdded] = useState(task?.date_added ?? "");
  const [actualCompletion, setActualCompletion] = useState(task?.actual_completion ?? "");
  const [expectedHours, setExpectedHours] = useState(
    task?.expected_duration_hours != null ? String(task.expected_duration_hours) : ""
  );
  const [actualHours, setActualHours] = useState(
    task?.actual_time_spent_hours != null ? String(task.actual_time_spent_hours) : ""
  );
  const [progress, setProgress] = useState(task?.progress_percent ?? 0);
  const [comments, setComments] = useState(task?.comments ?? "");

  // Tracks projects created during this modal session (e.g. auto-created
  // site projects) so repeated lookups don't create duplicates before the
  // parent's own project list has refreshed.
  const [knownProjects, setKnownProjects] = useState<Project[]>(projects);
  const [resolvingProject, setResolvingProject] = useState(false);

  const autoProjectName = projectNameForSite(eid, siteName);

  async function resolveProjectId(): Promise<string | null> {
    if (!autoProjectName) return projectId;
    const match = knownProjects.find(
      (p) => p.name.trim().toLowerCase() === autoProjectName.toLowerCase()
    );
    if (match) {
      if (projectId !== match.id) setProjectId(match.id);
      return match.id;
    }
    setResolvingProject(true);
    try {
      const created = await createProject(autoProjectName, colorForIndex(knownProjects.length));
      setKnownProjects((prev) => [...prev, created]);
      setProjectId(created.id);
      return created.id;
    } finally {
      setResolvingProject(false);
    }
  }

  const subtasks = savedTaskId
    ? tasks.filter((t) => t.parent_task_id === savedTaskId)
    : [];

  function handleProgressChange(value: number) {
    setProgress(value);
    if (value >= 100) setStatus("done");
    else if (value > 0 && status === "todo") setStatus("in_progress");
    else if (value === 0 && status === "done") setStatus("todo");
  }

  function handleStatusChange(value: Status) {
    setStatus(value);
    if (value === "done") setProgress(100);
    else if (value === "todo" && progress === 100) setProgress(0);
  }

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
    const resolvedProjectId = await resolveProjectId();
    const payload: Partial<Task> = {
      title: title.trim(),
      description: description.trim() || null,
      project_id: resolvedProjectId,
      assigned_to: assignedTo,
      status,
      priority,
      start_date: startDate || null,
      due_date: dueDate || null,
      is_milestone: isMilestone,
      milestone_date: isMilestone ? milestoneDate || null : null,
      task_type: taskType.trim() || null,
      eid: eid.trim() || null,
      site_name: siteName.trim() || null,
      raised_by: raisedBy.trim() || null,
      date_added: dateAdded || null,
      actual_completion: actualCompletion || null,
      expected_duration_hours: expectedHours.trim() ? Number(expectedHours) : null,
      actual_time_spent_hours: actualHours.trim() ? Number(actualHours) : null,
      progress_percent: progress,
      comments: comments.trim() || null,
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
      const resolvedProjectId = await resolveProjectId();
      const created = await onCreate({
        title: title.trim() || "Untitled task",
        description: description.trim() || null,
        project_id: resolvedProjectId,
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
                onChange={(e) => handleStatusChange(e.target.value as Status)}
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
              {autoProjectName ? (
                <div className="w-full rounded-lg border border-dashed border-[var(--c-line)] px-3 py-2 text-sm bg-black/[0.02] text-[#4d574f]">
                  {resolvingProject ? "Setting up…" : autoProjectName}
                  <span className="block text-[10px] text-[#a39d8c] mt-0.5">
                    Auto-set from EID — clear the EID to choose manually
                  </span>
                </div>
              ) : (
                <select
                  className={inputCls}
                  value={projectId ?? ""}
                  onChange={(e) => setProjectId(e.target.value || null)}
                >
                  <option value="">No project</option>
                  {knownProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
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

          {/* Network / ops tracker fields */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#8a8578] mb-2 font-display">
              Site &amp; task details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Task type</label>
                <input
                  className={inputCls}
                  list="task-type-suggestions"
                  placeholder="e.g. Full Audit"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                />
                <datalist id="task-type-suggestions">
                  {TASK_TYPE_SUGGESTIONS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Raised by</label>
                <input
                  className={inputCls}
                  placeholder="Who requested this"
                  value={raisedBy}
                  onChange={(e) => setRaisedBy(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>EID / circuit ID</label>
                <input
                  className={inputCls}
                  placeholder="e.g. 8232"
                  value={eid}
                  onChange={(e) => setEid(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Site name</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Boston"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                />
              </div>
            </div>
            {autoProjectName && (
              <p className="text-[11px] text-[#a39d8c] mt-1.5">
                This task's project will be <span className="font-medium">{autoProjectName}</span>{" "}
                — created automatically if it doesn't exist yet.
              </p>
            )}
          </div>

          {/* Time & progress */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#8a8578] mb-2 font-display">
              Time &amp; progress
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelCls}>Date added</label>
                <input
                  type="date"
                  className={inputCls}
                  value={dateAdded}
                  onChange={(e) => setDateAdded(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Actual completion</label>
                <input
                  type="date"
                  className={inputCls}
                  value={actualCompletion}
                  onChange={(e) => setActualCompletion(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Expected duration (h)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className={inputCls}
                  placeholder="e.g. 4"
                  value={expectedHours}
                  onChange={(e) => setExpectedHours(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Actual time spent (h)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className={inputCls}
                  placeholder="e.g. 3.5"
                  value={actualHours}
                  onChange={(e) => setActualHours(e.target.value)}
                />
              </div>
            </div>
            <label className={labelCls}>Progress — {progress}%</label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => handleProgressChange(Number(e.target.value))}
              className="w-full accent-[var(--c-green)]"
            />
          </div>

          <div>
            <label className={labelCls}>Comments</label>
            <textarea
              className={inputCls + " min-h-[50px] resize-none"}
              placeholder="Running notes / updates (optional)"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
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
