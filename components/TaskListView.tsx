"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Flag, Trash2, X } from "lucide-react";
import { Resource, Project, STATUS_LABELS, Task } from "@/lib/types";
import { fmt } from "@/lib/dateUtils";
import { downloadCSV } from "@/lib/csvImport";

type ColKey =
  | "task_number"
  | "title"
  | "assigned_to"
  | "project"
  | "eid"
  | "site_name"
  | "task_type"
  | "status"
  | "progress"
  | "due_date"
  | "actual_completion";

const COLUMNS: { key: ColKey; label: string }[] = [
  { key: "task_number", label: "Task ID" },
  { key: "title", label: "Task" },
  { key: "assigned_to", label: "Assigned to" },
  { key: "project", label: "Project" },
  { key: "eid", label: "EID" },
  { key: "site_name", label: "Site name" },
  { key: "task_type", label: "Task type" },
  { key: "status", label: "Status" },
  { key: "progress", label: "Progress" },
  { key: "due_date", label: "Due date" },
  { key: "actual_completion", label: "Date completed" },
];

export default function TaskListView({
  tasks,
  resources,
  projects,
  onOpenTask,
  onDeleteTask,
  canDelete,
}: {
  tasks: Task[];
  resources: Resource[];
  projects: Project[];
  onOpenTask: (task: Task) => void;
  onDeleteTask: (id: string) => Promise<void>;
  canDelete: boolean;
}) {
  const [sortKey, setSortKey] = useState<ColKey>("due_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<Record<ColKey, string>>({
    task_number: "",
    title: "",
    assigned_to: "",
    project: "",
    eid: "",
    site_name: "",
    task_type: "",
    status: "",
    progress: "",
    due_date: "",
    actual_completion: "",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function resourceName(id: string | null) {
    return resources.find((r) => r.id === id)?.name || "";
  }

  function projectName(id: string | null) {
    return projects.find((p) => p.id === id)?.name || "";
  }

  function cellText(t: Task, key: ColKey): string {
    switch (key) {
      case "task_number":
        return t.task_number || "";
      case "assigned_to":
        return resourceName(t.assigned_to);
      case "project":
        return projectName(t.project_id);
      case "eid":
        return t.eid || "";
      case "site_name":
        return t.site_name || "";
      case "task_type":
        return t.task_type || "";
      case "status":
        return STATUS_LABELS[t.status];
      case "progress":
        return `${t.progress_percent}%`;
      case "due_date":
        return t.due_date ? fmt(t.due_date) : "";
      case "actual_completion":
        return t.actual_completion ? fmt(t.actual_completion) : "";
      default:
        return t.title;
    }
  }

  function sortValue(t: Task, key: ColKey): string {
    if (key === "due_date") return t.due_date || "";
    if (key === "actual_completion") return t.actual_completion || "";
    if (key === "progress") return String(t.progress_percent).padStart(3, "0");
    return cellText(t, key).toLowerCase();
  }

  const filtered = useMemo(() => {
    return tasks.filter((t) =>
      COLUMNS.every((col) => {
        const f = filters[col.key].trim().toLowerCase();
        if (!f) return true;
        return cellText(t, col.key).toLowerCase().includes(f);
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, filters, resources]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: ColKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleSelectAll() {
    if (selected.size === sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.map((t) => t.id)));
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExportSelected() {
    const rows = [COLUMNS.map((c) => c.label).join(",")];
    for (const t of sorted.filter((t) => selected.has(t.id))) {
      rows.push(
        COLUMNS.map((c) => `"${cellText(t, c.key).replace(/"/g, '""')}"`).join(",")
      );
    }
    downloadCSV("selected-tasks.csv", rows.join("\n"));
  }

  async function handleDeleteSelected() {
    if (!confirm(`Delete ${selected.size} task${selected.size === 1 ? "" : "s"}? This can't be undone.`))
      return;
    for (const id of selected) {
      await onDeleteTask(id);
    }
    setSelected(new Set());
  }

  const allSelected = sorted.length > 0 && selected.size === sorted.length;

  return (
    <div className="flex flex-col h-full gap-2">
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--c-green)]/10 text-sm">
          <span className="font-medium text-[var(--c-green)]">
            {selected.size} selected
          </span>
          <button
            onClick={handleExportSelected}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-white border border-[var(--c-line)] hover:bg-black/5"
          >
            <Download size={12} />
            Export selected
          </button>
          {canDelete && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-white border border-[var(--c-line)] text-[#C23B3B] hover:bg-black/5"
            >
              <Trash2 size={12} />
              Delete selected
            </button>
          )}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-[#8a8578] hover:text-[var(--c-ink)]"
            title="Clear selection"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-[var(--c-line)] bg-white flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-[var(--c-line)]">
              <th className="px-3 py-2.5 w-9">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="accent-[var(--c-green)]"
                />
              </th>
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
            <tr className="border-b border-[var(--c-line)] bg-black/[0.015]">
              <th className="px-3 py-1.5" />
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-2 py-1.5">
                  <input
                    value={filters[col.key]}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, [col.key]: e.target.value }))
                    }
                    placeholder="enter filter"
                    className="w-full text-xs px-2 py-1 rounded-md border border-[var(--c-line)] bg-white outline-none focus:border-[var(--c-green)] font-normal"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr
                key={t.id}
                className={`border-b border-[var(--c-line)] last:border-0 hover:bg-black/[0.02] cursor-pointer ${
                  selected.has(t.id) ? "bg-[var(--c-green)]/[0.04]" : ""
                }`}
              >
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggleRow(t.id)}
                    className="accent-[var(--c-green)]"
                  />
                </td>
                <td
                  className="px-3 py-2.5 whitespace-nowrap text-[#a39d8c] font-mono text-[11px]"
                  onClick={() => onOpenTask(t)}
                >
                  {t.task_number || "—"}
                </td>
                <td className="px-3 py-2.5 max-w-[280px]" onClick={() => onOpenTask(t)}>
                  <span className="flex items-center gap-1.5">
                    {t.parent_task_id && <span className="text-[#c9c2b2] shrink-0">↳</span>}
                    {t.is_milestone && (
                      <Flag
                        size={11}
                        className="text-[var(--c-orange)] shrink-0"
                        fill="currentColor"
                      />
                    )}
                    <span className="truncate">{t.title}</span>
                  </span>
                </td>
                <td
                  className="px-3 py-2.5 whitespace-nowrap text-[#4d574f]"
                  onClick={() => onOpenTask(t)}
                >
                  {resourceName(t.assigned_to) || "—"}
                </td>
                <td
                  className="px-3 py-2.5 whitespace-nowrap text-[#4d574f]"
                  onClick={() => onOpenTask(t)}
                >
                  {projectName(t.project_id) || "—"}
                </td>
                <td
                  className="px-3 py-2.5 whitespace-nowrap text-[#4d574f] font-mono text-xs"
                  onClick={() => onOpenTask(t)}
                >
                  {t.eid || "—"}
                </td>
                <td
                  className="px-3 py-2.5 whitespace-nowrap text-[#4d574f]"
                  onClick={() => onOpenTask(t)}
                >
                  {t.site_name || "—"}
                </td>
                <td
                  className="px-3 py-2.5 whitespace-nowrap text-[#4d574f]"
                  onClick={() => onOpenTask(t)}
                >
                  {t.task_type || "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap" onClick={() => onOpenTask(t)}>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-black/5 text-[#4d574f]">
                    {STATUS_LABELS[t.status]}
                  </span>
                </td>
                <td
                  className="px-3 py-2.5 whitespace-nowrap text-[#8a8578] text-xs font-mono"
                  onClick={() => onOpenTask(t)}
                >
                  {t.progress_percent > 0 ? `${t.progress_percent}%` : "—"}
                </td>
                <td
                  className="px-3 py-2.5 whitespace-nowrap text-[#8a8578] text-xs font-mono"
                  onClick={() => onOpenTask(t)}
                >
                  {t.due_date ? fmt(t.due_date) : "—"}
                </td>
                <td
                  className="px-3 py-2.5 whitespace-nowrap text-[#8a8578] text-xs font-mono"
                  onClick={() => onOpenTask(t)}
                >
                  {t.actual_completion ? fmt(t.actual_completion) : "—"}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length + 1}
                  className="px-3 py-10 text-center text-sm text-[#a39d8c]"
                >
                  {tasks.length === 0 ? "No tasks yet." : "No tasks match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
