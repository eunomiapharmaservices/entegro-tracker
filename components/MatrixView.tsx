"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Project, Resource, STATUS_LABELS, STATUS_ORDER, Task } from "@/lib/types";

type Axis = "status" | "assigned" | "project";

const AXIS_LABELS: Record<Axis, string> = {
  status: "Task Status",
  assigned: "Assigned to",
  project: "Project",
};

const UNASSIGNED_KEY = "__unassigned__";
const NO_PROJECT_KEY = "__no_project__";

const STATUS_COLORS: Record<string, string> = {
  todo: "#a39d8c",
  in_progress: "#3B6E8F",
  on_hold: "#E07A3E",
  review: "#8A5FB0",
  done: "#1F5C4A",
};

const FALLBACK_PALETTE = ["#1F5C4A", "#E07A3E", "#3B6E8F", "#8A5FB0", "#C23B3B", "#7A8B84", "#2E8B6F", "#a39d8c"];

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
  const [groupAxis, setGroupAxis] = useState<Axis>("assigned"); // x-axis categories
  const [splitAxis, setSplitAxis] = useState<Axis>("status"); // stacked segments
  const [selected, setSelected] = useState<{ group: string; split: string } | null>(null);

  const topLevel = tasks.filter((t) => !t.parent_task_id);
  const axisOptions: Axis[] = ["status", "assigned", "project"];

  function axisKeys(t: Task, axis: Axis): string[] {
    if (axis === "status") return [t.status];
    if (axis === "project") return [t.project_id || NO_PROJECT_KEY];
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

  function colorFor(axis: Axis, key: string, index: number): string {
    if (axis === "status") return STATUS_COLORS[key] || FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
    if (axis === "project") {
      if (key === NO_PROJECT_KEY) return "#c9c2b2";
      return projects.find((p) => p.id === key)?.color || FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
    }
    if (key === UNASSIGNED_KEY) return "#c9c2b2";
    return resources.find((r) => r.id === key)?.color || FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
  }

  const groupValues = axisValues(groupAxis);
  const splitValues = axisValues(splitAxis);

  // Map of "groupKey|||splitKey" -> tasks, for drill-down
  const grid = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of topLevel) {
      const groups = axisKeys(t, groupAxis);
      const splits = axisKeys(t, splitAxis);
      for (const g of groups) {
        for (const s of splits) {
          const key = `${g}|||${s}`;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(t);
        }
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topLevel, groupAxis, splitAxis]);

  function cellTasks(groupKey: string, splitKey: string): Task[] {
    return grid.get(`${groupKey}|||${splitKey}`) || [];
  }

  // Only include group categories and split segments that actually have data,
  // so the chart isn't cluttered with empty bars/legend entries.
  const activeGroupValues = groupValues.filter((g) =>
    splitValues.some((s) => cellTasks(g, s).length > 0)
  );
  const activeSplitValues = splitValues.filter((s) =>
    groupValues.some((g) => cellTasks(g, s).length > 0)
  );

  const chartData = activeGroupValues.map((g) => {
    const row: Record<string, string | number> = { name: axisLabel(groupAxis, g), __key: g };
    for (const s of activeSplitValues) {
      row[axisLabel(splitAxis, s)] = cellTasks(g, s).length;
    }
    return row;
  });

  const groupKeyByName = new Map(activeGroupValues.map((g) => [axisLabel(groupAxis, g), g]));

  const grandTotal = topLevel.length;
  const chartHeight = Math.max(280, activeGroupValues.length * 46);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-[#4d574f]">
          Group by
          <select
            value={groupAxis}
            onChange={(e) => {
              const next = e.target.value as Axis;
              setGroupAxis(next);
              if (next === splitAxis) setSplitAxis(axisOptions.find((a) => a !== next) || "status");
              setSelected(null);
            }}
            className="rounded-lg border border-[var(--c-line)] px-2 py-1.5 text-sm bg-white outline-none focus:border-[var(--c-green)]"
          >
            {axisOptions.map((a) => (
              <option key={a} value={a} disabled={a === splitAxis}>
                {AXIS_LABELS[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-[#4d574f]">
          Split by
          <select
            value={splitAxis}
            onChange={(e) => {
              const next = e.target.value as Axis;
              setSplitAxis(next);
              if (next === groupAxis) setGroupAxis(axisOptions.find((a) => a !== next) || "status");
              setSelected(null);
            }}
            className="rounded-lg border border-[var(--c-line)] px-2 py-1.5 text-sm bg-white outline-none focus:border-[var(--c-green)]"
          >
            {axisOptions.map((a) => (
              <option key={a} value={a} disabled={a === groupAxis}>
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
        <div className="flex-1 min-w-0 rounded-xl border border-[var(--c-line)] bg-white p-4 overflow-y-auto">
          {chartData.length === 0 ? (
            <p className="text-sm text-[#a39d8c] text-center py-16">No tasks to show yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e2d8" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#8a8578" }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 12, fill: "#4d574f" }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(31,92,74,0.06)" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e7e2d8",
                    fontSize: 12,
                    fontFamily: "Inter, sans-serif",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {activeSplitValues.map((s, i) => {
                  const splitName = axisLabel(splitAxis, s);
                  return (
                    <Bar
                      key={s}
                      dataKey={splitName}
                      stackId="matrix"
                      fill={colorFor(splitAxis, s, i)}
                      radius={
                        i === activeSplitValues.length - 1 ? [0, 4, 4, 0] : undefined
                      }
                      onClick={(data: { __key?: string; name?: string }) => {
                        const groupKey = data?.__key ?? groupKeyByName.get(String(data?.name ?? ""));
                        if (groupKey) setSelected({ group: groupKey, split: s });
                      }}
                      className="cursor-pointer"
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {selected && (
          <div className="w-72 shrink-0 rounded-xl border border-[var(--c-line)] bg-white p-3 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-[#4d574f] font-display">
                {axisLabel(groupAxis, selected.group)} · {axisLabel(splitAxis, selected.split)}
              </p>
              <button
                onClick={() => setSelected(null)}
                className="text-[#a39d8c] hover:text-[var(--c-ink)] text-xs"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto">
              {cellTasks(selected.group, selected.split).map((t) => (
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
