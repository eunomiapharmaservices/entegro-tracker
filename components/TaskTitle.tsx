import { Task } from "@/lib/types";

// For auto-generated review tasks ("<title> Review"), highlights the
// trailing "Review" so it's obvious at a glance this is a review task,
// wherever the title shows up (Board, List, task editor).
export default function TaskTitle({
  task,
  className,
}: {
  task: Pick<Task, "title" | "is_review_task">;
  className?: string;
}) {
  if (!task.is_review_task || !task.title.endsWith(" Review")) {
    return <span className={className}>{task.title}</span>;
  }
  const base = task.title.slice(0, -" Review".length);
  return (
    <span className={className}>
      {base}{" "}
      <span className="text-[var(--c-orange)] font-semibold">Review</span>
    </span>
  );
}
