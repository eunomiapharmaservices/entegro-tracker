"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Flag } from "lucide-react";
import { Resource, STATUS_LABELS, Task } from "@/lib/types";
import { fmt } from "@/lib/dateUtils";

type SortKey =
  | "title"
  | "assigned_to"
  | "eid"
  | "site_name"
  | "task_type"
  | "status"
  | "date_added"
  | "actual_completion";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "title", label: "Task" },
  { key: "assigned_to", label: "Assigned to" },
  { key: "eid", label: "EID" },
  { key: "site_name", label: "Site name" },
  { key: "task_type", label: "Task type" },
  { key: "status", label: "Status" },
  { key: "date_added", label: "Date added" },
  { key: "actual_completion", label: "Date completed" },
];

export default function TaskListView({
  tasks,
  resources,
  onOpenTask,
}: {
  tasks: Task[];
  resources: Resource[];
  onOpenTask: (task: Task) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date_added");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function resourceName(id: string | null) {
    return resources.find((r) => r.id === id)?.name || "";
  }

  function sortValue(t: Task, key: SortKey): string {
    switch (key) {
      case "assigned_to":
        return resourceName(t.assigned_to).toLowerCase();
      case "eid":
        return (t.eid || "").toLowerCase();
      case "site_name":
        return (t.site_name || "").toLowerCase();
      case "task_type":
        return (t.task_type || "").toLowerCase();
      case "status":
        return STATUS_LABELS[t.status];
      case "date_added":
        return t.date_added || t.created_at.slice(0, 10) || "";
      case "actual_completion":
        return t.actual_completion || "";
      default:
        return t.title.toLowerCase();
    }
  }

  const sorted = useMemo(() => {
    const copy = [...tasks];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp = av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, sortKey, sortDir, resources]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="rounded-xl border border-[var(--c-line)] bg-white h-full overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white z-10 border-b border-[var(--c-line)]">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className="text-left px-3 py-2.5 font-display font-medium text-[#4d574f] cursor-pointer select-none whitespace-nowrap"
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key ? (
                    sortDir === "asc" ? (
                      <ArrowUp size={12} />
                    ) : (
                      <ArrowDown size={12} />
                    )
                  ) : (
                    <ArrowUpDown size={11} className="text-[#c9c2b2]" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr
              key={t.id}
              onClick={() => onOpenTask(t)}
              className="border-b border-[var(--c-line)] last:border-0 hover:bg-black/[0.02] cursor-pointer"
            >
              <td className="px-3 py-2.5 max-w-[280px]">
                <span className="flex items-center gap-1.5">
                  {t.parent_task_id && <span className="text-[#c9c2b2] shrink-0">↳</span>}
                  {t.is_milestone && (
                    <Flag size={11} className="text-[var(--c-orange)] shrink-0" fill="currentColor" />
                  )}
                  <span className="truncate">{t.title}</span>
                </span>
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-[#4d574f]">
                {resourceName(t.assigned_to) || "—"}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-[#4d574f] font-mono text-xs">
                {t.eid || "—"}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-[#4d574f]">
                {t.site_name || "—"}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-[#4d574f]">
                {t.task_type || "—"}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-black/5 text-[#4d574f]">
                  {STATUS_LABELS[t.status]}
                </span>
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-[#8a8578] text-xs font-mono">
                {t.date_added ? fmt(t.date_added) : "—"}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-[#8a8578] text-xs font-mono">
                {t.actual_completion ? fmt(t.actual_completion) : "—"}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-10 text-center text-sm text-[#a39d8c]">
                No tasks yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
