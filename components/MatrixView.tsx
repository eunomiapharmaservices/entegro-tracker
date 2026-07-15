"use client";

import { useMemo, useState } from "react";
import { Project, Resource, STATUS_LABELS, STATUS_ORDER, Task } from "@/lib/types";

type Axis = "status" | "assigned" | "project";

const AXIS_LABELS: Record<Axis, string> = {
  status: "Task Status",
  assigned: "Assigned to",
  project: "Project",
};

const UNASSIGNED_KEY = "__unassigned__";
const NO_PROJECT_KEY = "__no_project__";

export default function MatrixView({
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
  const [rowAxis, setRowAxis] = useState<Axis>("assigned");
  const [colAxis, setColAxis] = useState<Axis>("status");
  const [selected, setSelected] = useState<{ row: string; col: string } | null>(null);

  const topLevel = tasks.filter((t) => !t.parent_task_id);

  function axisKeys(t: Task, axis: Axis): string[] {
    if (axis === "status") return [t.status];
    if (axis === "project") return [t.project_id || NO_PROJECT_KEY];
    // assigned — a task can have multiple assignees, so it counts in each
    const ids = t.assignee_ids?.length ? t.assignee_ids : t.assigned_to ? [t.assigned_to] : [];
    return ids.length ? ids : [UNASSIGNED_KEY];
  }

  function axisLabel(axis: Axis, key: string): string {
    if (axis === "status") return STATUS_LABELS[key as Task["status"]] || key;
    if (axis === "project") {
      if (key === NO_PROJECT_KEY) return "No project";
      return projects.find((p) => p.id === key)?.name || "Unknown project";
    }
    if (key === UNASSIGNED_KEY) return "Unassigned";
    return resources.find((r) => r.id === key)?.name || "Unknown person";
  }

  function axisValues(axis: Axis): string[] {
    if (axis === "status") return [...STATUS_ORDER];
    if (axis === "project") return [...projects.map((p) => p.id), NO_PROJECT_KEY];
    return [...resources.map((r) => r.id), UNASSIGNED_KEY];
  }

  const rowValues = axisValues(rowAxis);
  const colValues = axisValues(colAxis);

  // Map of "rowKey|||colKey" -> tasks
  const grid = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of topLevel) {
      const rows = axisKeys(t, rowAxis);
      const cols = axisKeys(t, colAxis);
      for (const r of rows) {
        for (const c of cols) {
          const key = `${r}|||${c}`;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(t);
        }
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topLevel, rowAxis, colAxis]);

  function cellTasks(rowKey: string, colKey: string): Task[] {
    return grid.get(`${rowKey}|||${colKey}`) || [];
  }

  function rowTotal(rowKey: string): number {
    const seen = new Set<string>();
    let count = 0;
    for (const c of colValues) {
      for (const t of cellTasks(rowKey, c)) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          count++;
        }
      }
    }
    return count;
  }

  function colTotal(colKey: string): number {
    const seen = new Set<string>();
    let count = 0;
    for (const r of rowValues) {
      for (const t of cellTasks(r, colKey)) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          count++;
        }
      }
    }
    return count;
  }

  const grandTotal = topLevel.length;

  const axisOptions: Axis[] = ["status", "assigned", "project"];

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-[#4d574f]">
          Rows
          <select
            value={rowAxis}
            onChange={(e) => {
              const next = e.target.value as Axis;
              setRowAxis(next);
              if (next === colAxis) {
                setColAxis(axisOptions.find((a) => a !== next) || "status");
              }
              setSelected(null);
            }}
            className="rounded-lg border border-[var(--c-line)] px-2 py-1.5 text-sm bg-white outline-none focus:border-[var(--c-green)]"
          >
            {axisOptions.map((a) => (
              <option key={a} value={a} disabled={a === colAxis}>
                {AXIS_LABELS[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-[#4d574f]">
          Columns
          <select
            value={colAxis}
            onChange={(e) => {
              const next = e.target.value as Axis;
              setColAxis(next);
              if (next === rowAxis) {
                setRowAxis(axisOptions.find((a) => a !== next) || "status");
              }
              setSelected(null);
            }}
            className="rounded-lg border border-[var(--c-line)] px-2 py-1.5 text-sm bg-white outline-none focus:border-[var(--c-green)]"
          >
            {axisOptions.map((a) => (
              <option key={a} value={a} disabled={a === rowAxis}>
                {AXIS_LABELS[a]}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-[#a39d8c] ml-auto">
          {grandTotal} top-level task{grandTotal === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex gap-4">
        <div className="flex-1 min-w-0 overflow-auto rounded-xl border border-[var(--c-line)] bg-white">
          <table className="text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <th className="sticky left-0 z-20 bg-white text-left px-3 py-2.5 border-b border-r border-[var(--c-line)] font-display font-medium text-[#4d574f] min-w-[160px]">
                  {AXIS_LABELS[rowAxis]} \ {AXIS_LABELS[colAxis]}
                </th>
                {colValues.map((c) => (
                  <th
                    key={c}
                    className="px-3 py-2.5 border-b border-[var(--c-line)] font-display font-medium text-[#4d574f] text-center whitespace-nowrap min-w-[90px]"
                  >
                    {axisLabel(colAxis, c)}
                  </th>
                ))}
                <th className="px-3 py-2.5 border-b border-l border-[var(--c-line)] font-display font-medium text-[#4d574f] text-center min-w-[70px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rowValues.map((r) => (
                <tr key={r} className="hover:bg-black/[0.015]">
                  <td className="sticky left-0 z-10 bg-white text-left px-3 py-2 border-b border-r border-[var(--c-line)] text-[#4d574f] whitespace-nowrap">
                    {axisLabel(rowAxis, r)}
                  </td>
                  {colValues.map((c) => {
                    const matches = cellTasks(r, c);
                    const isSelected = selected?.row === r && selected?.col === c;
                    return (
                      <td
                        key={c}
                        onClick={() => matches.length > 0 && setSelected({ row: r, col: c })}
                        className={`px-3 py-2 border-b border-[var(--c-line)] text-center font-mono text-xs ${
                          matches.length > 0 ? "cursor-pointer hover:bg-[var(--c-green)]/10" : "text-[#c9c2b2]"
                        } ${isSelected ? "bg-[var(--c-green)]/15 font-semibold" : ""}`}
                      >
                        {matches.length || "—"}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 border-b border-l border-[var(--c-line)] text-center font-mono text-xs font-semibold text-[#4d574f]">
                    {rowTotal(r)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="sticky left-0 z-10 bg-white px-3 py-2 border-t-2 border-r border-[var(--c-line)] font-medium text-[#4d574f]">
                  Total
                </td>
                {colValues.map((c) => (
                  <td
                    key={c}
                    className="px-3 py-2 border-t-2 border-[var(--c-line)] text-center font-mono text-xs font-semibold text-[#4d574f]"
                  >
                    {colTotal(c)}
                  </td>
                ))}
                <td className="px-3 py-2 border-t-2 border-l border-[var(--c-line)] text-center font-mono text-xs font-bold text-[var(--c-green)]">
                  {grandTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="w-72 shrink-0 rounded-xl border border-[var(--c-line)] bg-white p-3 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-[#4d574f] font-display">
                {axisLabel(rowAxis, selected.row)} · {axisLabel(colAxis, selected.col)}
              </p>
              <button
                onClick={() => setSelected(null)}
                className="text-[#a39d8c] hover:text-[var(--c-ink)] text-xs"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto">
              {cellTasks(selected.row, selected.col).map((t) => (
                <button
                  key={t.id}
                  onClick={() => onOpenTask(t)}
                  className="text-left text-sm px-2 py-1.5 rounded-md hover:bg-black/[0.03] truncate"
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
