"use client";

import { useEffect, useState } from "react";
import { Flag, Plus, Trash2, X, Copy, RotateCcw } from "lucide-react";
import {
  Priority,
  Project,
  Resource,
  STATUS_LABELS,
  STATUS_ORDER,
  Status,
  Task,
  TaskComment,
  TASK_TYPE_SUGGESTIONS,
  GCR_TITLE_PREFIX,
  isGcrTaskType,
  isProjectClosure,
  projectNameForSite,
} from "@/lib/types";
import Avatar from "./Avatar";
import { colorForIndex } from "@/lib/csvImport";
import { isoDate, effectiveDueDate, fmt, daysSince, MAX_HOLD_EXTENSION_DAYS, fmtFull } from "@/lib/dateUtils";
import { useViewOnlyEmails } from "@/lib/useViewOnlyEmails";
import { notifyStatusChange } from "@/lib/notifyAssignment";

// Quick-add subtask suggestions — common checklist items across task types,
// click to add instantly instead of typing them out each time.
// Human-readable description of what changed between the saved task and the
// payload about to be written. Status and due-date changes are logged
// elsewhere (status here in the modal, due date by a database trigger), so
// they're skipped to avoid duplicate entries.
const LOGGED_FIELDS: { key: keyof Task; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "description", label: "Description" },
  { key: "project_id", label: "Project" },
  { key: "task_type", label: "Task type" },
  { key: "start_date", label: "Start date" },
  { key: "raised_by", label: "Raised by" },
  { key: "is_milestone", label: "Milestone" },
  { key: "milestone_date", label: "Milestone date" },
  { key: "depends_on_task_id", label: "Dependency" },
  { key: "netbuild_id", label: "Netbuild ID" },
  { key: "site_survey_id", label: "Site Survey ID" },
  { key: "gcr_id", label: "GCR ID" },
  { key: "main_night", label: "Main night" },
  { key: "backup_night", label: "Backup night" },
];

function describeChanges(before: Task | null, after: Partial<Task>): string[] {
  if (!before) return [];
  const lines: string[] = [];

  for (const { key, label } of LOGGED_FIELDS) {
    if (!(key in after)) continue;
    const oldVal = before[key];
    const newVal = after[key];
    if (oldVal === newVal) continue;
    if (!oldVal && !newVal) continue; // null vs "" — not a real change
    const fmtVal = (v: unknown) =>
      v === null || v === undefined || v === "" ? "(empty)" : String(v);
    lines.push(`${label} changed from ${fmtVal(oldVal)} to ${fmtVal(newVal)}`);
  }

  // Assignees compare as sets, since order isn't meaningful.
  if (after.assignee_ids) {
    const beforeIds = [...(before.assignee_ids ?? [])].sort().join(",");
    const afterIds = [...after.assignee_ids].sort().join(",");
    if (beforeIds !== afterIds) lines.push("Assignees changed");
  }

  return lines;
}

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
  addComment: (taskId: string, body: string, author?: string | null) => Promise<TaskComment | null>;
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
  // Existing tasks keep whatever title they have; new ones auto-generate
  // until the user types something of their own.
  const [titleSuffix, setTitleSuffix] = useState(task?.title_suffix ?? "");
  const [customTaskTypeMode, setCustomTaskTypeMode] = useState(
    !!task?.task_type && !TASK_TYPE_SUGGESTIONS.includes(task.task_type)
  );
  const [eid, setEid] = useState(task?.eid ?? "");
  const [siteName, setSiteName] = useState(task?.site_name ?? "");
  // New tasks default Raised by to whoever is signed in; existing tasks keep theirs.
  const [raisedBy, setRaisedBy] = useState(task?.raised_by ?? (task ? "" : authorName || ""));
  const [reviewerId, setReviewerId] = useState<string | null>(task?.reviewer_id ?? null);
  const [dateAdded, setDateAdded] = useState(task?.date_added ?? (task ? "" : isoDate(new Date())));
  const [netbuildId, setNetbuildId] = useState(task?.netbuild_id ?? "");
  const [siteSurveyId, setSiteSurveyId] = useState(task?.site_survey_id ?? "");
  const [gcrId, setGcrId] = useState(task?.gcr_id ?? "");
  const [mainNight, setMainNight] = useState(task?.main_night ?? "");
  const [backupNight, setBackupNight] = useState(task?.backup_night ?? "");
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

  const subtasks = savedTaskId
    ? tasks.filter((t) => t.parent_task_id === savedTaskId)
    : [];
  // A task can't be completed while any of its checklist items are open.
  const openSubtasks = subtasks.filter((s) => s.status !== "done").length;
  const blockedBySubtasks = openSubtasks > 0;
  // With subtasks present, progress is their completion rate — not a manual
  // figure. Same for auto-generated tasks, which are driven by their chain.
  const derivedProgress =
    subtasks.length > 0
      ? Math.round(((subtasks.length - openSubtasks) / subtasks.length) * 100)
      : progress;
  const progressIsDerived = subtasks.length > 0 || !!task?.auto_generated_from;

  // Dependencies are scoped to the same EID — a task should only be able to
  // depend on other work at the same site/circuit. EID now lives on the
  // project, so this matches on the selected project's EID (falling back to
  // the same project when it has no EID set yet).
  const selectedProject = projects.find((p) => p.id === projectId);
  // Titles are always "EID <project> – <task type>"; anything the user types
  // is appended after that and stored separately so chained tasks can rebuild
  // their own title the same way.
  const titlePrefix = `EID ${selectedProject?.eid?.trim() || selectedProject?.name?.trim() || ""} – ${taskType.trim()}`;
  const composedTitle = titleSuffix.trim() ? `${titlePrefix} – ${titleSuffix.trim()}` : titlePrefix;
  // EID and Site name are no longer entered on the task — they belong to the
  // project (managed in "Manage projects"), and are copied onto the task so
  // board cards, List columns, and exports keep showing them. Falls back to
  // whatever the task already had if its project hasn't been filled in yet.
  const projectEid = selectedProject?.eid ?? task?.eid ?? null;
  const projectSiteName = selectedProject?.site_name ?? task?.site_name ?? null;
  const dependencyOptions = tasks.filter((t) => {
    if (t.id === task?.id || t.depends_on_task_id === task?.id) return false;
    if (t.status === "done") return false; // completed work can't gate anything
    if (!projectId) return false;
    const theirProject = projects.find((p) => p.id === t.project_id);
    if (selectedProject?.eid) {
      return theirProject?.eid === selectedProject.eid;
    }
    return t.project_id === projectId;
  });
  const dependencyTask = dependsOnTaskId ? tasks.find((t) => t.id === dependsOnTaskId) : null;

  // GCR tasks carry four extra identifiers, all required.
  const isGcrType = isGcrTaskType(taskType);
  const isClosureType = isProjectClosure(taskType);

  const missingFields: string[] = [];
  if (!taskType.trim()) missingFields.push("Task type");
  if (!projectId) missingFields.push("Project");
  if (status === "done" && blockedBySubtasks)
    missingFields.push(`${openSubtasks} subtask${openSubtasks === 1 ? "" : "s"} still open`);
  if (isGcrType) {
    if (!netbuildId.trim()) missingFields.push("Netbuild ID");
    if (!siteSurveyId.trim()) missingFields.push("Site Survey ID");
    if (!gcrId.trim()) missingFields.push("GCR ID");
    if (!mainNight) missingFields.push("Main night");
    if (!backupNight) missingFields.push("Backup night");
  }
  const isValid = missingFields.length === 0;

  function handleProgressChange(value: number) {
    if (value >= 100 && blockedBySubtasks) {
      alert(
        `Complete all ${openSubtasks} subtask${openSubtasks === 1 ? "" : "s"} before marking this task done.`
      );
      return;
    }
    setProgress(value);
    if (value >= 100) {
      setStatus("done");
    } else if (value > 0 && status === "todo") {
      setStatus("in_progress");
    } else if (value === 0 && status === "done") {
      setStatus("todo");
    }
  }

  function handleStatusChange(value: Status) {
    if (value === "done" && blockedBySubtasks) {
      alert(
        `Complete all ${openSubtasks} subtask${openSubtasks === 1 ? "" : "s"} before marking this task done.`
      );
      return;
    }
    setStatus(value);
    if (value === "done") {
      setProgress(100);
    } else if (value === "todo" && progress === 100) {
      setProgress(0);
    }
    // GCR status and GCR task type are kept in step — setting either one sets
    // the other, so a GCR task is never half-labelled.
    if (value === "gcr") {
      setCustomTaskTypeMode(false);
      setTaskType("GCR Support");
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
    const payload: Partial<Task> = {
      title: composedTitle,
      title_suffix: titleSuffix.trim() || null,
      description: description.trim() || null,
      project_id: projectId,
      assigned_to: assigneeIds[0] ?? null,
      assignee_ids: assigneeIds,
      status,
      priority,
      start_date: startDate || null,
      due_date: dueDate || null,
      depends_on_task_id: dependsOnTaskId,
      is_milestone: isClosureType ? true : isMilestone,
      milestone_date: isMilestone ? milestoneDate || null : null,
      task_type: taskType.trim() || null,
      eid: projectEid,
      site_name: projectSiteName,
      raised_by: raisedBy.trim() || null,
      reviewer_id: reviewerId,
      date_added: dateAdded || null,
      netbuild_id: isGcrType ? netbuildId.trim() || null : null,
      site_survey_id: isGcrType ? siteSurveyId.trim() || null : null,
      gcr_id: isGcrType ? gcrId.trim() || null : null,
      main_night: isGcrType ? mainNight || null : null,
      backup_night: isGcrType ? backupNight || null : null,
      progress_percent: progressIsDerived ? derivedProgress : progress,
    };
    try {
      if (savedTaskId) {
        // Log every field the user actually changed, so the comment log is a
        // full audit trail rather than just status/due-date changes.
        const changes = describeChanges(task, payload);
        await onUpdate(savedTaskId, payload);
        for (const line of changes) {
          await addComment(savedTaskId, line, authorName || null);
        }
        if (lastSavedStatus && lastSavedStatus !== status) {
          await addComment(
            savedTaskId,
            `Status changed from "${STATUS_LABELS[lastSavedStatus]}" to "${STATUS_LABELS[status]}"`,
            authorName || null
          );
          const project = projects.find((p) => p.id === projectId);
          for (const id of assigneeIds) {
            const resource = resources.find((r) => r.id === id);
            if (resource?.email) {
              await notifyStatusChange(
                resource.email,
                { ...payload, title: title.trim() } as Task,
                STATUS_LABELS[lastSavedStatus],
                STATUS_LABELS[status],
                project?.name,
                authorName || null
              );
            }
          }
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
        const created = await onCreate({
        title: composedTitle,
      title_suffix: titleSuffix.trim() || null,
        description: description.trim() || null,
        project_id: projectId,
        assigned_to: assigneeIds[0] ?? null,
        assignee_ids: assigneeIds,
        status,
        priority,
        start_date: startDate || null,
        due_date: dueDate || null,
        depends_on_task_id: dependsOnTaskId,
        is_milestone: isClosureType ? true : isMilestone,
        milestone_date: isMilestone ? milestoneDate || null : null,
        task_type: taskType.trim() || null,
        eid: projectEid,
        site_name: projectSiteName,
        raised_by: raisedBy.trim() || null,
        reviewer_id: reviewerId,
        date_added: dateAdded || null,
              netbuild_id: isGcrType ? netbuildId.trim() || null : null,
      site_survey_id: isGcrType ? siteSurveyId.trim() || null : null,
      gcr_id: isGcrType ? gcrId.trim() || null : null,
      main_night: isGcrType ? mainNight || null : null,
      backup_night: isGcrType ? backupNight || null : null,
      progress_percent: progressIsDerived ? derivedProgress : progress,
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
        title: composedTitle + " (Copy)",
        title_suffix: titleSuffix.trim() || null,
        description: description.trim() || null,
        project_id: projectId,
        assigned_to: assigneeIds[0] ?? null,
        assignee_ids: assigneeIds,
        status: "todo",
        priority,
        start_date: startDate || null,
        due_date: dueDate || null,
        depends_on_task_id: null,
        is_milestone: isClosureType ? true : isMilestone,
        milestone_date: isMilestone ? milestoneDate || null : null,
        task_type: taskType.trim() || null,
        eid: projectEid,
        site_name: projectSiteName,
        raised_by: raisedBy.trim() || null,
        reviewer_id: reviewerId,
        date_added: isoDate(new Date()),
        actual_completion: null,
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
              {task?.auto_generated_from && (
                <span className="ml-2 text-[11px] font-normal text-[var(--c-green)] bg-[rgb(var(--c-green-rgb)/0.1)] px-2 py-0.5 rounded-full align-middle">
                  Auto-created
                </span>
              )}
              {task?.is_review_task && (
                <span className="ml-2 text-[11px] font-normal text-[var(--c-orange)] bg-[rgb(var(--c-orange-rgb)/0.1)] px-2 py-0.5 rounded-full align-middle">
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
            {(() => {
              const proj = projects.find((p) => p.id === projectId);
              return proj?.site_dark_date ? (
                <p className="text-[10px] text-[var(--c-orange)] font-mono mt-0.5">
                  SDD {fmtFull(proj.site_dark_date)}
                </p>
              ) : null;
            })()}
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-4">
          <fieldset disabled={!canEdit} className="contents">
          {assigneeIds.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap -mb-1">
              {assigneeIds.map((id) => {
                const r = resources.find((x) => x.id === id);
                if (!r) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-white border border-[var(--c-line)] text-xs"
                  >
                    <Avatar resource={r} size={18} />
                    {r.name}
                    <button
                      onClick={() =>
                        setAssigneeIds((prev) => prev.filter((x) => x !== id))
                      }
                      className="text-[#c9c2b2] hover:text-[#C23B3B] leading-none"
                      title={`Unassign ${r.name}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div>
            <p className="text-[11px] text-[#a39d8c] font-mono mb-1">{titlePrefix}</p>
            <input
              className="w-full text-lg font-medium bg-transparent border-b border-[var(--c-line)] pb-2 outline-none focus:border-[var(--c-green)] disabled:opacity-60"
              placeholder="Add more detail (optional)"
              value={titleSuffix}
              onChange={(e) => setTitleSuffix(e.target.value)}
              autoFocus
            />
          </div>

          <textarea
            className={inputCls + " min-h-[60px] resize-none"}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3 items-start">
            <div className="flex flex-col gap-3">
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
                <label className={labelCls}>Raised by</label>
                <select
                  className={inputCls}
                  value={raisedBy}
                  onChange={(e) => setRaisedBy(e.target.value)}
                >
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
          </div>

          <div className="grid grid-cols-2 gap-3 items-start">
            <div>
              <label className={labelCls}>
                Project <span className="text-[#C23B3B]">*</span>
              </label>
              <select
                className={inputCls}
                value={projectId ?? ""}
                onChange={(e) => setProjectId(e.target.value || null)}
              >
                <option value="">Select a project…</option>
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
              {selectedProject && (selectedProject.eid || selectedProject.site_name) && (
                <p className="text-[10px] text-[#a39d8c] mt-1">
                  {[selectedProject.site_name, selectedProject.eid ? `#${selectedProject.eid}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>

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
                    // Picking GCR prefixes the title and moves the task to
                    // the GCR status, mirroring the reverse in
                    // handleStatusChange.
                    if (e.target.value.trim().toLowerCase() === "gcr") {
                      setStatus("gcr");
                    }
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
            {isGcrType ? (
              <>
                <div>
                  <label className={labelCls}>
                    Main night <span className="text-[#C23B3B]">*</span>
                  </label>
                  <input
                    type="date"
                    className={inputCls}
                    value={mainNight}
                    onChange={(e) => setMainNight(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Backup night <span className="text-[#C23B3B]">*</span>
                  </label>
                  <input
                    type="date"
                    className={inputCls}
                    value={backupNight}
                    onChange={(e) => setBackupNight(e.target.value)}
                  />
                  <p className="text-[10px] text-[#a39d8c] mt-1">
                    GCR tasks show on the calendar on both nights.
                  </p>
                </div>
              </>
            ) : (
              <>
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
                className={inputCls + (!isNew && !canDelete ? " bg-black/[0.04] text-[#8a8578] cursor-not-allowed" : "")}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!isNew && !canDelete}
                title={!isNew && !canDelete ? "Only Admin/Super can change the due date after creation" : undefined}
              />
              {!isNew && !canDelete && (
                <p className="text-[10px] text-[#a39d8c] mt-1">
                  Only Admin/Super can change this after a task is created.
                </p>
              )}
              {status === "on_hold" && task?.hold_started_at && (
                <p className="text-[11px] text-[var(--c-orange)] mt-1.5">
                  On hold {daysSince(task.hold_started_at)} day
                  {daysSince(task.hold_started_at) === 1 ? "" : "s"} (since{" "}
                  {fmt(task.hold_started_at)}) — effective due date is currently{" "}
                  {fmt(effectiveDueDate(dueDate || null, status, task.hold_started_at))}
                  {daysSince(task.hold_started_at) >= MAX_HOLD_EXTENSION_DAYS
                    ? `, capped at ${MAX_HOLD_EXTENSION_DAYS} days.`
                    : "."}
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
              </>
            )}

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

            {!isClosureType && (
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
            )}


          {isGcrType && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#8a8578] mb-2 font-display">
                GCR details
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    Netbuild ID <span className="text-[#C23B3B]">*</span>
                  </label>
                  <input
                    className={inputCls}
                    value={netbuildId}
                    onChange={(e) => setNetbuildId(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Site Survey ID <span className="text-[#C23B3B]">*</span>
                  </label>
                  <input
                    className={inputCls}
                    value={siteSurveyId}
                    onChange={(e) => setSiteSurveyId(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    GCR ID <span className="text-[#C23B3B]">*</span>
                  </label>
                  <input
                    className={inputCls}
                    value={gcrId}
                    onChange={(e) => setGcrId(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#8a8578] mb-2 font-display">
              Progress
            </p>
            <label className={labelCls}>
              Progress — {progressIsDerived ? derivedProgress : progress}%
              {progressIsDerived && (
                <span className="font-normal text-[#a39d8c]">
                  {" "}
                  · {subtasks.length > 0 ? "from subtasks" : "auto-managed"}
                </span>
              )}
            </label>
            {progressIsDerived ? (
              <div className="h-2 rounded-full bg-black/[0.06] overflow-hidden">
                <div
                  className="h-full bg-[var(--c-green-light)]"
                  style={{ width: `${derivedProgress}%` }}
                />
              </div>
            ) : (
              <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => handleProgressChange(Number(e.target.value))}
              className="w-full accent-[var(--c-green)]"
            />
            )}
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
                    // Sort explicitly — the fetch is newest-first, but a task's
                    // own log reads better oldest-first.
                    .sort(
                      (a, b) =>
                        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    )
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
                        // Also log on the parent, so the task's own log shows
                        // its checklist being worked through.
                        if (savedTaskId) {
                          await addComment(
                            savedTaskId,
                            `Subtask ${newStatus === "done" ? "completed" : "reopened"}: "${st.title}"`,
                            authorName || null
                          );
                        }
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
