export type Status = "todo" | "in_progress" | "on_hold" | "review" | "gcr" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";

export interface Resource {
  id: string;
  name: string;
  email: string | null;
  color: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  eid: string | null;
  site_name: string | null;
  site_dark_date: string | null;
  mrp_planner: string | null;
  ip_tech: string | null;
  total_circuits: number;
  migration_required: number;
  migration_complete: number;
  data_cleanse_required: number;
  data_cleanse_complete: number;
  total_devices: number;
  total_decommissioned: number;
  total_rings: number;
  rings_migrated: number;
  created_at: string;
}

export interface Task {
  id: string;
  task_number: string | null;
  project_id: string | null;
  parent_task_id: string | null;
  depends_on_task_id: string | null;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  assigned_to: string | null;
  assignee_ids: string[];
  start_date: string | null;
  due_date: string | null;
  is_milestone: boolean;
  milestone_date: string | null;
  position: number;
  // Network/ops tracker fields
  task_type: string | null;
  eid: string | null;
  site_name: string | null;
  raised_by: string | null;
  date_added: string | null;
  actual_completion: string | null;
  expected_duration_hours: number | null;
  actual_time_spent_hours: number | null;
  progress_percent: number;
  comments: string | null;
  deleted_at: string | null;
  netbuild_id: string | null;
  site_survey_id: string | null;
  gcr_id: string | null;
  title_suffix: string | null;
  auto_generated_from: string | null;
  main_night: string | null;
  backup_night: string | null;
  hold_started_at: string | null;
  reviewer_id: string | null;
  is_review_task: boolean;
  review_of_task_id: string | null;
  created_at: string;
  updated_at: string;
}

// Common task types seen in the IP Daily Task Tracker workbook — offered as
// suggestions in the task type field, but any free text is accepted.
export const TASK_TYPE_SUGGESTIONS = [
  "Audit",
  "Admin Work",
  "Circuit/Ring Design and Planning",
  "Config & MOP Generation",
  "Config Removal",
  "Data Cleanse",
  "GCR creation and invites",
  "GCR Support",
  "MRP Planning",
  "NAT Updates",
  "Port Reservations",
  "Pre Wires / TPC",
  "Stranded X-connects removal",
  "Training",
];

// When a task has an EID (circuit/site ID), its project is derived from that
// rather than picked manually — matching the "EID - Site" naming convention
// used in the source tracker (e.g. "8232 - Boston"). Returns null if there's
// no EID to build a name from.
export function projectNameForSite(
  eid: string | null | undefined,
  siteName: string | null | undefined
): string | null {
  const e = (eid || "").trim();
  if (!e) return null;
  const s = (siteName || "").trim();
  return s ? `${e} - ${s}` : e;
}

export interface ProjectChangeLog {
  id: string;
  project_id: string;
  body: string;
  author: string | null;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  body: string;
  author: string | null;
  created_at: string;
}

export interface TaskWithSubtasks extends Task {
  subtasks: Task[];
}

export const GCR_TITLE_PREFIX = "GCR Support – ";

// GCR tasks are scheduled by Main Night / Backup Night instead of start and
// due dates — shared so the form, board and calendar all agree on what
// counts as a GCR task.
export function isGcrTask(t: Pick<Task, "task_type" | "status">): boolean {
  return isGcrTaskType(t.task_type) || t.status === "gcr";
}

// "GCR Support" is the current GCR task type; "GCR" is kept so tasks created
// before the type list was revised still behave as GCR tasks.
export function isGcrTaskType(taskType: string | null): boolean {
  const t = (taskType || "").trim().toLowerCase();
  return t === "gcr support" || t === "gcr";
}

export const STATUS_LABELS: Record<Status, string> = {
  todo: "New",
  in_progress: "In progress",
  on_hold: "On hold",
  review: "In review",
  gcr: "GCR",
  done: "Completed",
};

export const STATUS_ORDER: Status[] = ["todo", "in_progress", "on_hold", "review", "gcr", "done"];

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: "#7A8B84",
  medium: "#3B6E8F",
  high: "#E07A3E",
  urgent: "#C23B3B",
};
