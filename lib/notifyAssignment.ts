import { Task } from "./types";

export async function notifyAssignment(
  to: string,
  task: Pick<Task, "title" | "eid" | "site_name" | "due_date" | "priority" | "task_type">,
  projectName?: string | null,
  assignedByName?: string | null
) {
  try {
    await fetch("/api/notify-assignment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        title: task.title,
        projectName: projectName || null,
        eid: task.eid || null,
        siteName: task.site_name || null,
        dueDate: task.due_date || null,
        priority: task.priority || null,
        taskType: task.task_type || null,
        assignedByName: assignedByName || null,
      }),
    });
  } catch (err) {
    // Never let a notification failure block the task save itself.
    console.warn("Failed to send assignment email:", err);
  }
}
