"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { Project, Resource, STATUS_LABELS, Task, isGcrTask } from "@/lib/types";
import { fmtFull } from "@/lib/dateUtils";
import { downloadCSV } from "@/lib/csvImport";
import TaskTitle from "./TaskTitle";

type ColKey =
  | "task_number"
  | "project"
  | "title"
  | "assigned_to"
  | "netbuild_id"
  | "site_survey_id"
  | "gcr_id"
  | "gcr_date"
  | "main_night"
  | "backup_night"
  | "status";

const COLUMNS: { key: ColKey; label: string }[] = [
  { key: "task_number", label: "Task ID" },
  { key: "project", label: "Project" },
  { key: "title", label: "Title" },
  { key: "assigned_to", label: "Assigned to" },
  { key: "netbuild_id", label: "Netbuild ID" },
  { key: "site_survey_id", label: "Site Survey ID" },
  { key: "gcr_id", label: "GCR ID" },
  { key: "gcr_date", label: "GCR Date" },
  { key: "main_night", label: "Main Night" },
  { key: "backup_night", label: "Backup Night" },
  { key: "status", label: "Status" },
];

export default function NbGcrView({
  tasks,
  resources,
  projects,
  onOpenTask,
}: {
  tasks: Task[];
  resources: Resource[];
  projects: Project[];
  onOpenTask: (task: Task) => void;
}) {
  const [sortKey, setSortKey] = useState<ColKey>("gcr_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<Record<ColKey, string>>({
    task_number: "",
    project: "",
    title: "",
    assigned_to: "",
    netbuild_id: "",
    site_survey_id: "",
    gcr_id: "",
    gcr_date: "",
    main_night: "",
    backup_night: "",
    status: "",
  });

  function assigneeNames(t: Task): string {
    const ids = t.assignee_ids?.length ? t.assignee_ids : t.assigned_to ? [t.assigned_to] : [];
    return ids
      .map((id) => resources.find((r) => r.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  }

  function projectName(id: string | null): string {
    return projects.find((p) => p.id === id)?.name || "";
  }

  function cellText(t: Task, key: ColKey): string {
    switch (key) {
      case "task_number":
        return t.task_number || "";
      case "project":
        return projectName(t.project_id);
      case "assigned_to":
        return assigneeNames(t);
      case "netbuild_id":
        return t.netbuild_id || "";
      case "site_survey_id":
        return t.site_survey_id || "";
      case "gcr_id":
        return t.gcr_id || "";
      case "gcr_date":
        return t.gcr_date ? fmtFull(t.gcr_date) : "";
      case "main_night":
        return t.main_night ? fmtFull(t.main_night) : "";
      case "backup_night":
        return t.backup_night ? fmtFull(t.backup_night) : "";
      case "status":
        return STATUS_LABELS[t.status];
      default:
        return t.title;
    }
  }

  function sortValue(t: Task, key: ColKey): string {
    if (key === "gcr_date") return t.gcr_date || "";
    if (key === "main_night") return t.main_night || "";
    if (key === "backup_night") return t.backup_night || "";
    return cellText(t, key).toLowerCase();
  }

  const gcrTasks = useMemo(() => tasks.filter((t) => !t.parent_task_id && isGcrTask(t)), [tasks]);

  const filtered = useMemo(() => {
    return gcrTasks.filter((t) =>
      COLUMNS.every((col) => {
        const q = filters[col.key].trim().toLowerCase();
        if (!q) return true;
        return cellText(t, col.key).toLowerCase().includes(q);
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gcrTasks, filters, resources, projects]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      // Blanks always sort last, regardless of direction — an empty GCR date
      // shouldn't outrank a real one.
      if (!av && bv) return 1;
      if (av && !bv) return -1;
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: ColKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function handleExport() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      COLUMNS.map((c) => c.label).join(","),
      ...sorted.map((t) => COLUMNS.map((c) => esc(cellText(t, c.key))).join(",")),
    ];
    downloadCSV(`nb-gcr-${new Date().toISOString().slice(0, 10)}.csv`, rows.join("\n"));
  }

  return (
    <div className="rounded-xl border border-[var(--c-line)] bg-white h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-line)] shrink-0">
        <p className="text-sm text-[#4d574f]">
          <span className="font-medium">{sorted.length}</span> GCR task
          {sorted.length === 1 ? "" : "s"}
          {sorted.length !== gcrTasks.length && (
            <span className="text-[#a39d8c]"> (of {gcrTasks.length})</span>
          )}
        </p>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-white border border-[var(--c-line)] hover:bg-black/5"
        >
          <Download size={12} />
          Export CSV
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="text-sm border-collapse w-full">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-3 py-2 border-b border-[var(--c-line)] font-display font-medium text-[#4d574f] whitespace-nowrap"
                >
                  <button
                    onClick={() => toggleSort(col.key)}
                    className="flex items-center gap-1 hover:text-[var(--c-green)]"
                  >
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === "asc" ? (
                        <ArrowUp size={11} />
                      ) : (
                        <ArrowDown size={11} />
                      )
                    ) : (
                      <ArrowUpDown size={11} className="text-[#c9c2b2]" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-2 py-1.5 border-b border-[var(--c-line)]">
                  <input
                    value={filters[col.key]}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, [col.key]: e.target.value }))
                    }
                    placeholder="Filter…"
                    className="w-full min-w-[80px] rounded-md border border-[var(--c-line)] px-1.5 py-1 text-[11px] bg-white outline-none focus:border-[var(--c-green)] font-normal"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr
                key={t.id}
                onClick={() => onOpenTask(t)}
                className="cursor-pointer hover:bg-black/[0.02] border-b border-[var(--c-line)]"
              >
                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-[#a39d8c]">
                  {t.task_number || "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-[#4d574f]">
                  {projectName(t.project_id) || "—"}
                </td>
                <td className="px-3 py-2.5 max-w-[260px]">
                  <span className="truncate block">
                    <TaskTitle task={t} />
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-[#4d574f]">
                  {assigneeNames(t) || "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs">
                  {t.netbuild_id || "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs">
                  {t.site_survey_id || "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs">
                  {t.gcr_id || "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-[#8a8578]">
                  {t.gcr_date ? fmtFull(t.gcr_date) : "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-[#8a8578]">
                  {t.main_night ? fmtFull(t.main_night) : "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-[#8a8578]">
                  {t.backup_night ? fmtFull(t.backup_night) : "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/5 text-[#4d574f]">
                    {STATUS_LABELS[t.status]}
                  </span>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="py-12 text-center text-[#a39d8c]">
                  {gcrTasks.length === 0
                    ? "No GCR tasks yet."
                    : "No GCR tasks match those filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
