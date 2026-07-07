export type Status = "todo" | "in_progress" | "review" | "done";
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
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  assigned_to: string | null;
  start_date: string | null;
  due_date: string | null;
  is_milestone: boolean;
  milestone_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TaskWithSubtasks extends Task {
  subtasks: Task[];
}

export const STATUS_LABELS: Record<Status, string> = {
  todo: "To do",
  in_progress: "In progress",
  review: "In review",
  done: "Done",
};

export const STATUS_ORDER: Status[] = ["todo", "in_progress", "review", "done"];

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
