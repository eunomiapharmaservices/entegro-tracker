"use client";

import { useEffect, useState } from "react";
import { Flag, Plus, Trash2, X, Copy, RotateCcw } from "lucide-react";
import {
  PRIORITY_LABELS,
  Priority,
  Project,
  Resource,
  STATUS_LABELS,
  STATUS_ORDER,
  Status,
  Task,
  TaskComment,
  TASK_TYPE_SUGGESTIONS,
  projectNameForSite,
} from "@/lib/types";
import Avatar from "./Avatar";
import { colorForIndex } from "@/lib/csvImport";
import { isoDate, effectiveDueDate, fmt } from "@/lib/dateUtils";
import { useViewOnlyEmails } from "@/lib/useViewOnlyEmails";

// Quick-add subtask suggestions — common checklist items across task types,
// click to add instantly instead of typing them out each time.
const PREDEFINED_SUBTASKS = [
  "Collect supporting documents",
  "Verify configuration",
  "Get approval / sign-off",
  "Update documentation",
  "Notify stakeholders",
];

interface Props {
  task: Task | null; // null = creating a new top-level task
  defaultProjectId: string | null;
  tasks: Task[];
  resources: Resource[];
  projects: Project[];
  taskComments: TaskComment[];
  onClose: () => void;
  onCreate: (input: Partial<Task>) => Promise<Task>;
  onUpdate: (id: string, input: Partial<Task>) => Promise<Task>;
  onDelete: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  createProject: (name: string, color: string) => Promise<Project>;
  addComment: (taskId: string, body: string, author?: string | null) => Promise<TaskComment>;
  authorName: string;
  canDelete: boolean;
  canEdit: boolean;
}

export default function TaskModal({
  task,
  defaultProjectId,
  tasks,
  resources,
  projects,
  taskComments,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onRestore,
  createProject,
  addComment,
  authorName,
  canDelete,
  canEdit,
}: Props) {
  const isNew = !task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [projectId, setProjectId] = useState<string | null>(
    task?.project_id ?? defaultProjectId
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    task?.assignee_ids?.length ? task.assignee_ids : task?.assigned_to ? [task.assigned_to] : []
  );
  const [status, setStatus] = useState<Status>(task?.status ?? "todo");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [startDate, setStartDate] = useState(task?.start_date ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [dependsOnTaskId, setDependsOnTaskId] = useState<string | null>(
    task?.depends_on_task_id ?? null
  );
  const [isMilestone, setIsMilestone] = useState(task?.is_milestone ?? false);
  const [milestoneDate, setMilestoneDate] = useState(task?.milestone_date ?? "");
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [savedTaskId, setSavedTaskId] = useState<string | null>(task?.id ?? null);

  // Network/ops tracker fields
  const [taskType, setTaskType] = useState(task?.task_type ?? "");
  const [customTaskTypeMode, setCustomTaskTypeMode] = useState(
    !!task?.task_type && !TASK_TYPE_SUGGESTIONS.includes(task.task_type)
  );
  const [eid, setEid] = useState(task?.eid ?? "");
  const [siteName, setSiteName] = useState(task?.site_name ?? "");
  const [raisedBy, setRaisedBy] = useState(task?.raised_by ?? "");
  const [reviewerId, setReviewerId] = useState<string | null>(task?.reviewer_id ?? null);
  const [dateAdded, setDateAdded] = useState(task?.date_added ?? (task ? "" : isoDate(new Date())));
  const [actualCompletion, setActualCompletion] = useState(task?.actual_completion ?? "");
  const [expectedHours, setExpectedHours] = useState(
    task?.expected_duration_hours != null ? String(task.expected_duration_hours) : ""
  );
  const [actualHours, setActualHours] = useState(
    task?.actual_time_spent_hours != null ? String(task.actual_time_spent_hours) : ""
  );
  const [progress, setProgress] = useState(task?.progress_percent ?? 0);
  const [lastSavedStatus, setLastSavedStatus] = useState<Status | null>(task?.status ?? null);
  const [newCommentText, setNewCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Tracks projects created during this modal session (e.g. auto-created
  // site projects) so repeated lookups don't create duplicates before the
  // parent's own project list has refreshed.
  const [knownProjects, setKnownProjects] = useState<Project[]>(projects);
  const { isViewOnlyResource } = useViewOnlyEmails();
  // View Only accounts can't act on work, so they shouldn't be assignable —
  // except keep showing whoever a task is *already* assigned to, even if
  // they've since become View Only, so the field never silently hides the
  // current value.
  const assignableResources = resources.filter(
    (r) => r.id === task?.assigned_to || !isViewOnlyResource(r)
  );
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

  // Exclude this task itself and anything that already depends on it
  // directly (a simple guard against the most obvious two-task cycle).
  const dependencyOptions = tasks.filter(
    (t) => t.id !== task?.id && t.depends_on_task_id !== task?.id
  );
  const dependencyTask = dependsOnTaskId ? tasks.find((t) => t.id === dependsOnTaskId) : null;

  const missingFields: string[] = [];
  if (!title.trim()) missingFields.push("Title");
  if (!taskType.trim()) missingFields.push("Task type");
  if (!eid.trim()) missingFields.push("EID");
  if (!siteName.trim()) missingFields.push("Site name");
  if (!expectedHours.trim()) missingFields.push("Expected duration");
  const isValid = missingFields.length === 0;

  function handleProgressChange(value: number) {
    setProgress(value);
    if (value >= 100) {
      setStatus("done");
      setActualCompletion((prev) => prev || isoDate(new Date()));
    } else if (value > 0 && status === "todo") {
      setStatus("in_progress");
    } else if (value === 0 && status === "done") {
      setStatus("todo");
    }
  }

  function handleStatusChange(value: Status) {
    setStatus(value);
    if (value === "done") {
      setProgress(100);
      setActualCompletion((prev) => prev || isoDate(new Date()));
    } else if (value === "todo" && progress === 100) {
      setProgress(0);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    const resolvedProjectId = await resolveProjectId();
    const payload: Partial<Task> = {
      title: title.trim(),
      description: description.trim() || null,
      project_id: resolvedProjectId,
      assigned_to: assigneeIds[0] ?? null,
      assignee_ids: assigneeIds,
      status,
      priority,
      start_date: startDate || null,
      due_date: dueDate || null,
      depends_on_task_id: dependsOnTaskId,
      is_milestone: isMilestone,
      milestone_date: isMilestone ? milestoneDate || null : null,
      task_type: taskType.trim() || null,
      eid: eid.trim() || null,
      site_name: siteName.trim() || null,
      raised_by: raisedBy.trim() || null,
      reviewer_id: reviewerId,
      date_added: dateAdded || null,
      actual_completion: actualCompletion || null,
      expected_duration_hours: expectedHours.trim() ? Number(expectedHours) : null,
      actual_time_spent_hours: actualHours.trim() ? Number(actualHours) : null,
      progress_percent: progress,
    };
    try {
      if (savedTaskId) {
        await onUpdate(savedTaskId, payload);
        if (lastSavedStatus && lastSavedStatus !== status) {
          await addComment(
            savedTaskId,
            `Status changed from "${STATUS_LABELS[lastSavedStatus]}" to "${STATUS_LABELS[status]}"`,
            authorName || null
          );
        }
        setLastSavedStatus(status);
      } else {
        const created = await onCreate(payload);
        setSavedTaskId(created.id);
        setLastSavedStatus(status);
        await addComment(created.id, "Task created", authorName || null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePostComment() {
    if (!newCommentText.trim() || !savedTaskId) return;
    setPostingComment(true);
    try {
      await addComment(savedTaskId, newCommentText.trim(), authorName || null);
      setNewCommentText("");
    } finally {
      setPostingComment(false);
    }
  }

  async function handleAddSubtask(titleOverride?: string) {
    const subtaskTitle = (titleOverride ?? newSubtaskTitle).trim();
    if (!subtaskTitle) return;
    let parentId = savedTaskId;
    if (!parentId) {
      if (!isValid) {
        alert(
          `Fill in ${missingFields.join(", ")} on the main task before adding subtasks.`
        );
        return;
      }
      // Auto-save parent first so the subtask has something to attach to
      const resolvedProjectId = await resolveProjectId();
      const created = await onCreate({
        title: title.trim(),
        description: description.trim() || null,
        project_id: resolvedProjectId,
        assigned_to: assigneeIds[0] ?? null,
        assignee_ids: assigneeIds,
        status,
        priority,
        start_date: startDate || null,
        due_date: dueDate || null,
        depends_on_task_id: dependsOnTaskId,
        is_milestone: isMilestone,
        milestone_date: isMilestone ? milestoneDate || null : null,
        task_type: taskType.trim() || null,
        eid: eid.trim() || null,
        site_name: siteName.trim() || null,
        raised_by: raisedBy.trim() || null,
        reviewer_id: reviewerId,
        date_added: dateAdded || null,
        actual_completion: actualCompletion || null,
        expected_duration_hours: expectedHours.trim() ? Number(expectedHours) : null,
        actual_time_spent_hours: actualHours.trim() ? Number(actualHours) : null,
        progress_percent: progress,
      });
      parentId = created.id;
      setSavedTaskId(created.id);
      setLastSavedStatus(status);
      await addComment(created.id, "Task created", authorName || null);
    }
    const subtask = await onCreate({
      title: subtaskTitle,
      parent_task_id: parentId,
      project_id: projectId,
      status: "todo",
      priority: "medium",
    });
    await addComment(subtask.id, "Task created", authorName || null);
    setNewSubtaskTitle("");
  }

  async function handleDelete() {
    if (!savedTaskId) {
      onClose();
      return;
    }
    if (!confirm("Delete this task and all its subtasks?")) return;
    try {
      await addComment(savedTaskId, "Task deleted", authorName || null);
      await onDelete(savedTaskId);
      onClose();
    } catch (err) {
      alert(`Couldn't delete this task: ${(err as Error).message || "unknown error"}`);
    }
  }

  async function handleRestore() {
    if (!savedTaskId) return;
    setRestoring(true);
    try {
      await onRestore(savedTaskId);
      await addComment(savedTaskId, "Task restored", authorName || null);
      onClose();
    } catch (err) {
      alert(`Couldn't restore this task: ${(err as Error).message || "unknown error"}`);
    } finally {
      setRestoring(false);
    }
  }

  async function handleDuplicate() {
    if (!isValid) {
      alert(`Fill in ${missingFields.join(", ")} before duplicating.`);
      return;
    }
    setDuplicating(true);
    setDuplicateMessage(null);
    try {
      const copy = await onCreate({
        title: title.trim() + " (Copy)",
        description: description.trim() || null,
        project_id: projectId,
        assigned_to: assigneeIds[0] ?? null,
        assignee_ids: assigneeIds,
        status: "todo",
        priority,
        start_date: startDate || null,
        due_date: dueDate || null,
        depends_on_task_id: null,
        is_milestone: isMilestone,
        milestone_date: isMilestone ? milestoneDate || null : null,
        task_type: taskType.trim() || null,
        eid: eid.trim() || null,
        site_name: siteName.trim() || null,
        raised_by: raisedBy.trim() || null,
        reviewer_id: reviewerId,
        date_added: isoDate(new Date()),
        actual_completion: null,
        expected_duration_hours: expectedHours.trim() ? Number(expectedHours) : null,
        actual_time_spent_hours: null,
        progress_percent: 0,
      });
      await addComment(copy.id, "Task created", authorName || null);
      setDuplicateMessage(`Duplicated as "${copy.title}"`);
    } catch (err) {
      alert(`Couldn't duplicate this task: ${(err as Error).message || "unknown error"}`);
    } finally {
      setDuplicating(false);
    }
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
          <div>
            <h2 className="font-display font-semibold text-base">
              {isNew ? "New task" : "Edit task"}
              {task?.is_review_task && (
                <span className="ml-2 text-[11px] font-normal text-[var(--c-orange)] bg-[var(--c-orange)]/10 px-2 py-0.5 rounded-full align-middle">
                  Review task
                </span>
              )}
              {task?.deleted_at && (
                <span className="ml-2 text-[11px] font-normal text-[#C23B3B] bg-[#C23B3B]/10 px-2 py-0.5 rounded-full align-middle">
                  Deleted
                </span>
              )}
            </h2>
            {task?.task_number && (
              <p className="text-[10px] text-[#a39d8c] font-mono mt-0.5">{task.task_number}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-4">
          <fieldset disabled={!canEdit} className="contents">
          <div>
            <input
              className="w-full text-lg font-medium bg-transparent border-b border-[var(--c-line)] pb-2 outline-none focus:border-[var(--c-green)] disabled:opacity-60"
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
              <label className={labelCls}>
                Assigned to
                {assigneeIds.length > 1 && (
                  <span className="text-[#a39d8c] font-normal"> ({assigneeIds.length})</span>
                )}
              </label>
              <div className="w-full rounded-lg border border-[var(--c-line)] bg-white max-h-32 overflow-y-auto">
                {assignableResources.length === 0 && (
                  <p className="text-xs text-[#c9c2b2] px-3 py-2">No one to assign yet.</p>
                )}
                {assignableResources.map((r) => (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-black/[0.03]"
                  >
                    <input
                      type="checkbox"
                      checked={assigneeIds.includes(r.id)}
                      onChange={(e) => {
                        setAssigneeIds((prev) =>
                          e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                        );
                      }}
                      className="accent-[var(--c-green)]"
                    />
                    {r.name}
                  </label>
                ))}
              </div>
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
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setProjectId(id);
                    if (id) {
                      const p = knownProjects.find((pp) => pp.id === id);
                      // Existing site projects are named "EID - Site" — parse
                      // that back out so EID/site don't need retyping, and the
                      // mandatory EID field is satisfied by picking the project.
                      const match = p?.name.match(/^(\S+)\s*-\s*(.+)$/);
                      if (match) {
                        if (!eid.trim()) setEid(match[1]);
                        if (!siteName.trim()) setSiteName(match[2]);
                      }
                    }
                  }}
                >
                  <option value="">No project</option>
                  {knownProjects
                    .filter((p) => !p.archived || p.id === projectId)
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.archived ? " (archived)" : ""}
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
              {status === "on_hold" && task?.hold_started_at && (
                <p className="text-[11px] text-[var(--c-orange)] mt-1.5">
                  Extending automatically while on hold — effective due date is currently{" "}
                  {fmt(effectiveDueDate(dueDate || null, status, task.hold_started_at))}.
                </p>
              )}
              {status === "review" && (
                <p className="text-[11px] text-[#a39d8c] mt-1.5">
                  Frozen while in review. A "{title.trim() || "…"} Review" task has been created
                  {reviewerId
                    ? ` for ${resources.find((r) => r.id === reviewerId)?.name || "the reviewer"}`
                    : raisedBy
                    ? ` for ${raisedBy} (from Raised by)`
                    : ""}
                  — once it's marked Completed, however long it took gets added onto this due
                  date automatically.
                </p>
              )}
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Depends on</label>
              <select
                className={inputCls}
                value={dependsOnTaskId ?? ""}
                onChange={(e) => setDependsOnTaskId(e.target.value || null)}
              >
                <option value="">No dependency</option>
                {dependencyOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                    {t.status === "done" ? " (Completed)" : ""}
                  </option>
                ))}
              </select>
              {dependencyTask && (
                <p className="text-[11px] text-[#a39d8c] mt-1.5">
                  {dependencyTask.is_review_task
                    ? `This is the review task created when this task entered In Review — completing it adds however long the review took onto this task's due date, rather than setting a start date.`
                    : dependencyTask.status === "done"
                    ? `This task's start date is set the day after "${dependencyTask.title}" was completed, and updates automatically if that changes.`
                    : `Once "${dependencyTask.title}" is marked Completed, this task's start date will automatically be set to the day after.`}
                </p>
              )}
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
                <label className={labelCls}>
                  Task type <span className="text-[#C23B3B]">*</span>
                </label>
                <select
                  className={inputCls + (!isNew && !canDelete ? " bg-black/[0.04] text-[#8a8578] cursor-not-allowed" : "")}
                  value={customTaskTypeMode ? "__custom__" : taskType}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setCustomTaskTypeMode(true);
                      setTaskType("");
                    } else {
                      setCustomTaskTypeMode(false);
                      setTaskType(e.target.value);
                    }
                  }}
                  disabled={!isNew && !canDelete}
                  title={!isNew && !canDelete ? "Only Admin/Super can change task type after creation" : undefined}
                >
                  <option value="">Select a type…</option>
                  {TASK_TYPE_SUGGESTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value="__custom__">Other (type your own)…</option>
                </select>
                {customTaskTypeMode && (
                  <input
                    className={inputCls + " mt-2" + (!isNew && !canDelete ? " bg-black/[0.04] text-[#8a8578] cursor-not-allowed" : "")}
                    placeholder="Custom task type"
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    disabled={!isNew && !canDelete}
                    autoFocus
                  />
                )}
                {!isNew && !canDelete && (
                  <p className="text-[10px] text-[#a39d8c] mt-1">
                    Only Admin/Super can change this after a task is created.
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Raised by</label>
                <select
                  className={inputCls}
                  value={raisedBy}
                  onChange={(e) => setRaisedBy(e.target.value)}
                >
                  <option value="">Unspecified</option>
                  {raisedBy && !resources.some((r) => r.name === raisedBy) && (
                    <option value={raisedBy}>{raisedBy} (not in People)</option>
                  )}
                  {resources.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Reviewer</label>
                <select
                  className={inputCls}
                  value={reviewerId ?? ""}
                  onChange={(e) => setReviewerId(e.target.value || null)}
                >
                  <option value="">Unspecified</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#a39d8c] mt-1">
                  If this task is set to In Review, a "{title.trim() || "…"} Review" task is
                  created for them automatically — or for whoever's in Raised by, if this is left
                  unspecified.
                </p>
              </div>
              <div>
                <label className={labelCls}>
                  EID / circuit ID <span className="text-[#C23B3B]">*</span>
                </label>
                <input
                  className={inputCls}
                  placeholder="e.g. 8232"
                  value={eid}
                  onChange={(e) => setEid(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Site name <span className="text-[#C23B3B]">*</span>
                </label>
                <input
                  className={inputCls}
                  placeholder="e.g. Boston"
                  value={siteName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSiteName(v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : v);
                  }}
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
                  disabled={status !== "done"}
                  className={
                    inputCls +
                    (status !== "done" ? " bg-black/[0.04] text-[#a39d8c] cursor-not-allowed" : "")
                  }
                  value={actualCompletion}
                  onChange={(e) => setActualCompletion(e.target.value)}
                />
                {status !== "done" && (
                  <p className="text-[10px] text-[#a39d8c] mt-1">
                    Set automatically once status is Done
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>
                  Expected duration (h) <span className="text-[#C23B3B]">*</span>
                </label>
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
            {task?.comments && (
              <div className="bg-black/[0.03] rounded-lg px-3 py-2 mb-2 text-sm text-[#6b7570]">
                <p className="text-[10px] uppercase tracking-wide text-[#a39d8c] mb-0.5">
                  Imported note
                </p>
                {task.comments}
              </div>
            )}
            {savedTaskId ? (
              <>
                <div className="flex flex-col gap-2 mb-2 max-h-48 overflow-y-auto">
                  {taskComments
                    .filter((c) => c.task_id === savedTaskId)
                    .map((c) => (
                      <div
                        key={c.id}
                        className="bg-white border border-[var(--c-line)] rounded-lg px-3 py-2"
                      >
                        <p className="text-[10px] text-[#a39d8c] font-mono mb-0.5">
                          {c.author ? `${c.author} · ` : ""}
                          {new Date(c.created_at).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="text-sm">{c.body}</p>
                      </div>
                    ))}
                  {taskComments.filter((c) => c.task_id === savedTaskId).length === 0 && (
                    <p className="text-xs text-[#c9c2b2] px-1">No comments yet.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    className={inputCls + " flex-1 min-w-0"}
                    placeholder={`Comment as ${authorName || "you"}`}
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handlePostComment();
                      }
                    }}
                  />
                  <button
                    onClick={handlePostComment}
                    disabled={postingComment || !newCommentText.trim()}
                    className="shrink-0 rounded-lg bg-[var(--c-green)] text-white text-sm font-medium px-4 hover:bg-[#194a3b] disabled:opacity-50"
                  >
                    {postingComment ? "Posting…" : "Post"}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-[#c9c2b2]">
                Save the task first, then you can add timestamped comments here.
              </p>
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
                    onChange={async (e) => {
                      const newStatus = e.target.checked ? "done" : "todo";
                      const oldStatus = st.status;
                      await onUpdate(st.id, { status: newStatus });
                      if (oldStatus !== newStatus) {
                        await addComment(
                          st.id,
                          `Status changed from "${STATUS_LABELS[oldStatus]}" to "${STATUS_LABELS[newStatus]}"`,
                          authorName || null
                        );
                      }
                    }}
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
                  {canDelete && (
                    <button
                      onClick={() => onDelete(st.id)}
                      className="text-[#c9c2b2] hover:text-[#C23B3B]"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {PREDEFINED_SUBTASKS.filter(
                (label) => !subtasks.some((s) => s.title === label)
              ).map((label) => (
                <button
                  key={label}
                  onClick={() => handleAddSubtask(label)}
                  className="text-[11px] px-2 py-1 rounded-full border border-dashed border-[var(--c-line)] text-[#8a8578] hover:border-[var(--c-green)] hover:text-[var(--c-green)] transition-colors"
                >
                  + {label}
                </button>
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
                onClick={() => handleAddSubtask()}
                className="shrink-0 rounded-lg border border-[var(--c-line)] px-3 hover:bg-black/5"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          </fieldset>

          <div className="flex items-center justify-between pt-2 gap-3">
            <div className="flex items-center gap-3 shrink-0">
              {task?.deleted_at && canDelete ? (
                <button
                  onClick={handleRestore}
                  disabled={restoring}
                  className="text-sm text-[var(--c-green)] hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <RotateCcw size={13} />
                  {restoring ? "Restoring…" : "Restore task"}
                </button>
              ) : canDelete ? (
                <button
                  onClick={handleDelete}
                  className="text-sm text-[#C23B3B] hover:underline flex items-center gap-1"
                >
                  <Trash2 size={13} />
                  Delete task
                </button>
              ) : (
                <span />
              )}
              {canEdit && savedTaskId && (
                <button
                  onClick={handleDuplicate}
                  disabled={duplicating}
                  className="text-sm text-[#4d574f] hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <Copy size={13} />
                  {duplicating ? "Duplicating…" : "Duplicate"}
                </button>
              )}
              {duplicateMessage && (
                <span className="text-[11px] text-[var(--c-green)]">{duplicateMessage}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {canEdit && !isValid && (
                <p className="text-[11px] text-[#C23B3B] text-right">
                  Required: {missingFields.join(", ")}
                </p>
              )}
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={onClose}
                  className="text-sm px-4 py-2 rounded-lg hover:bg-black/5"
                >
                  {canEdit ? "Cancel" : "Close"}
                </button>
                {canEdit && (
                  <button
                    onClick={async () => {
                      await handleSave();
                      onClose();
                    }}
                    disabled={saving || !isValid}
                    className="text-sm px-4 py-2 rounded-lg bg-[var(--c-green)] text-white font-medium hover:bg-[#194a3b] disabled:opacity-50"
                  >
                    {saving ? "Saving…" : isNew ? "Create task" : "Save changes"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
