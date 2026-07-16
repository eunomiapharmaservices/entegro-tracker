"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, CheckCircle2, Activity, AlertTriangle } from "lucide-react";
import { Project, Resource, STATUS_LABELS, STATUS_ORDER, Task } from "@/lib/types";
import { effectiveDueDate, isOverdue } from "@/lib/dateUtils";
import TaskListView from "./TaskListView";

type Axis = "status" | "assigned" | "project" | "task_type";

const AXIS_LABELS: Record<Axis, string> = {
  status: "Task Status",
  assigned: "Assigned to",
  project: "Project",
  task_type: "Task Type",
};

const UNASSIGNED_KEY = "__unassigned__";
const NO_PROJECT_KEY = "__no_project__";
const NO_TYPE_KEY = "__no_type__";
const GCR_KEY = "GCR";

// Any task type starting with "GCR" (GCR_Support, GCR_MOP, "GCR Support",
// however it's typed) gets grouped under one "GCR" category — everything
// else keeps its own type as-is.
function taskTypeCategory(rawType: string | null): string {
  const t = (rawType || "").trim();
  if (!t) return NO_TYPE_KEY;
  if (t.toLowerCase().replace(/[\s_]+/g, "").startsWith("gcr")) return GCR_KEY;
  return t;
}

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
  const [groupAxis, setGroupAxis] = useState<Axis>("assigned");
  const [splitAxis, setSplitAxis] = useState<Axis>("status");
  const [drill, setDrill] = useState<{ label: string; tasks: Task[]; groupKey?: string } | null>(
    null
  );

  const topLevel = tasks.filter((t) => !t.parent_task_id);
  const axisOptions: Axis[] = ["status", "assigned", "project", "task_type"];

  function axisKeys(t: Task, axis: Axis): string[] {
    if (axis === "status") return [t.status];
    if (axis === "project") return [t.project_id || NO_PROJECT_KEY];
    if (axis === "task_type") return [taskTypeCategory(t.task_type)];
    const ids = t.assignee_ids?.length ? t.assignee_ids : t.assigned_to ? [t.assigned_to] : [];
    return ids.length ? ids : [UNASSIGNED_KEY];
  }

  function axisLabel(axis: Axis, key: string): string {
    if (axis === "status") return STATUS_LABELS[key as Task["status"]] || key;
    if (axis === "project") {
      if (key === NO_PROJECT_KEY) return "No project";
      return projects.find((p) => p.id === key)?.name || "Unknown project";
    }
    if (axis === "task_type") {
      return key === NO_TYPE_KEY ? "No type" : key;
    }
    if (key === UNASSIGNED_KEY) return "Unassigned";
    return resources.find((r) => r.id === key)?.name || "Unknown person";
  }

  function axisValues(axis: Axis): string[] {
    if (axis === "status") return [...STATUS_ORDER];
    if (axis === "project") return [...projects.map((p) => p.id), NO_PROJECT_KEY];
    if (axis === "task_type") {
      const seen = new Set<string>();
      for (const t of topLevel) seen.add(taskTypeCategory(t.task_type));
      // GCR first (it's the category being tracked specifically), then the rest alphabetically
      return Array.from(seen).sort((a, b) =>
        a === GCR_KEY ? -1 : b === GCR_KEY ? 1 : a.localeCompare(b)
      );
    }
    return [...resources.map((r) => r.id), UNASSIGNED_KEY];
  }

  function colorFor(axis: Axis, key: string, index: number): string {
    if (axis === "status") return STATUS_COLORS[key] || FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
    if (axis === "project") {
      if (key === NO_PROJECT_KEY) return "#c9c2b2";
      return projects.find((p) => p.id === key)?.color || FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
    }
    if (axis === "task_type") {
      if (key === GCR_KEY) return "#8A5FB0";
      if (key === NO_TYPE_KEY) return "#c9c2b2";
      return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
    }
    if (key === UNASSIGNED_KEY) return "#c9c2b2";
    return resources.find((r) => r.id === key)?.color || FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
  }

  // ---- Summary metrics (with their matching task lists, for drill-down) ----
  const totalTasks = topLevel;
  const completedTasks = topLevel.filter((t) => t.status === "done");
  const activeTasks = topLevel.filter((t) => ["in_progress", "on_hold", "review"].includes(t.status));
  const overdueTasks = topLevel.filter((t) =>
    isOverdue(effectiveDueDate(t.due_date, t.status, t.hold_started_at), t.status)
  );

  // ---- Group-by breakdown (bar chart + progress list) ----
  const groupValues = axisValues(groupAxis);
  const tasksByGroup = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of topLevel) {
      for (const g of axisKeys(t, groupAxis)) {
        if (!map.has(g)) map.set(g, []);
        map.get(g)!.push(t);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topLevel, groupAxis]);

  const activeGroupValues = groupValues
    .filter((g) => (tasksByGroup.get(g) || []).length > 0)
    .sort((a, b) => (tasksByGroup.get(b) || []).length - (tasksByGroup.get(a) || []).length);

  const barData = activeGroupValues.map((g) => ({
    key: g,
    name: axisLabel(groupAxis, g),
    count: (tasksByGroup.get(g) || []).length,
    fill: colorFor(groupAxis, g, activeGroupValues.indexOf(g)),
  }));

  // ---- Split-by breakdown (donut) ----
  const splitValues = axisValues(splitAxis);
  const tasksBySplit = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of topLevel) {
      for (const s of axisKeys(t, splitAxis)) {
        if (!map.has(s)) map.set(s, []);
        map.get(s)!.push(t);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topLevel, splitAxis]);

  const activeSplitValues = splitValues.filter((s) => (tasksBySplit.get(s) || []).length > 0);
  const donutData = activeSplitValues.map((s, i) => ({
    key: s,
    name: axisLabel(splitAxis, s),
    value: (tasksBySplit.get(s) || []).length,
    fill: colorFor(splitAxis, s, i),
  }));

  const metricCards = [
    { label: "Total tasks", value: totalTasks.length, tasks: totalTasks, color: "#1F5C4A", icon: TrendingUp, sub: "Across all projects" },
    { label: "Completed", value: completedTasks.length, tasks: completedTasks, color: "#2E8B6F", icon: CheckCircle2, sub: "Marked Completed" },
    { label: "Active", value: activeTasks.length, tasks: activeTasks, color: "#3B6E8F", icon: Activity, sub: "In progress, on hold, or in review" },
    { label: "Overdue", value: overdueTasks.length, tasks: overdueTasks, color: "#C23B3B", icon: AlertTriangle, sub: "Past their due date" },
  ];

  function selectGroupDrill(g: string) {
    const label = axisLabel(groupAxis, g);
    const t = tasksByGroup.get(g) || [];
    setDrill((prev) => (prev?.groupKey === g ? null : { label, tasks: t, groupKey: g }));
  }

  function selectMetricDrill(label: string, matchTasks: Task[]) {
    setDrill((prev) => (prev?.label === label && !prev?.groupKey ? null : { label, tasks: matchTasks }));
  }

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-1">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {metricCards.map((m) => (
          <button
            key={m.label}
            onClick={() => selectMetricDrill(m.label, m.tasks)}
            disabled={m.value === 0}
            className={`text-left rounded-xl border bg-white p-4 transition-colors ${
              drill?.label === m.label && !drill?.groupKey
                ? "border-[var(--c-green)] ring-1 ring-[var(--c-green)]/30"
                : "border-[var(--c-line)]"
            } ${m.value > 0 ? "hover:bg-black/[0.015] cursor-pointer" : "cursor-default"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#8a8578]">{m.label}</span>
              <m.icon size={15} style={{ color: m.color }} />
            </div>
            <p className="font-display font-semibold text-2xl" style={{ color: m.color }}>
              {m.value}
            </p>
            <p className="text-[11px] text-[#a39d8c] mt-0.5">{m.sub}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">
        <div className="lg:col-span-2 rounded-xl border border-[var(--c-line)] bg-white p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="font-display font-semibold text-sm">Tasks by {AXIS_LABELS[groupAxis]}</p>
            <select
              value={groupAxis}
              onChange={(e) => {
                const next = e.target.value as Axis;
                setGroupAxis(next);
                setDrill(null);
              }}
              className="rounded-lg border border-[var(--c-line)] px-2 py-1 text-xs bg-white outline-none focus:border-[var(--c-green)]"
            >
              {axisOptions.map((a) => (
                <option key={a} value={a}>
                  {AXIS_LABELS[a]}
                </option>
              ))}
            </select>
          </div>
          {barData.length === 0 ? (
            <p className="text-sm text-[#a39d8c] text-center py-16">No tasks to show yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e2d8" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#8a8578" }}
                  interval={0}
                  angle={barData.length > 6 ? -30 : 0}
                  textAnchor={barData.length > 6 ? "end" : "middle"}
                  height={barData.length > 6 ? 50 : 30}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8a8578" }} />
                <Tooltip
                  cursor={{ fill: "rgba(31,92,74,0.06)" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e7e2d8",
                    fontSize: 12,
                    fontFamily: "Inter, sans-serif",
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[4, 4, 0, 0]}
                  onClick={(data: { key?: string }) => data?.key && selectGroupDrill(data.key)}
                  className="cursor-pointer"
                >
                  {barData.map((d) => (
                    <Cell key={d.key} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-[var(--c-line)] bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display font-semibold text-sm">By {AXIS_LABELS[splitAxis]}</p>
            <select
              value={splitAxis}
              onChange={(e) => setSplitAxis(e.target.value as Axis)}
              className="rounded-lg border border-[var(--c-line)] px-2 py-1 text-xs bg-white outline-none focus:border-[var(--c-green)]"
            >
              {axisOptions.map((a) => (
                <option key={a} value={a}>
                  {AXIS_LABELS[a]}
                </option>
              ))}
            </select>
          </div>
          {donutData.length === 0 ? (
            <p className="text-sm text-[#a39d8c] text-center py-16">No tasks to show yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {donutData.map((d) => (
                      <Cell key={d.key} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e7e2d8",
                      fontSize: 12,
                      fontFamily: "Inter, sans-serif",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1 mt-2">
                {donutData.map((d) => (
                  <div key={d.key} className="flex items-center gap-1.5 text-xs text-[#4d574f]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} />
                    <span className="truncate flex-1">{d.name}</span>
                    <span className="font-mono text-[#a39d8c]">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--c-line)] bg-white p-4 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-1 shrink-0">
          <p className="font-display font-semibold text-sm">Progress by {AXIS_LABELS[groupAxis]}</p>
          <p className="text-xs text-[#a39d8c]">
            {activeGroupValues.length} active ·{" "}
            {totalTasks.length > 0 ? Math.round((completedTasks.length / totalTasks.length) * 100) : 0}% average completion
          </p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto mt-2 flex flex-col divide-y divide-[var(--c-line)]">
          {activeGroupValues.map((g) => {
            const groupTasks = tasksByGroup.get(g) || [];
            const done = groupTasks.filter((t) => t.status === "done").length;
            const pct = groupTasks.length > 0 ? Math.round((done / groupTasks.length) * 100) : 0;
            const hasActive = groupTasks.some((t) => t.status !== "done");
            return (
              <button
                key={g}
                onClick={() => selectGroupDrill(g)}
                className={`text-left py-3 px-1 hover:bg-black/[0.02] ${
                  drill?.groupKey === g ? "bg-[var(--c-green)]/5" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="font-medium text-sm truncate">{axisLabel(groupAxis, g)}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[#8a8578]">
                      {groupTasks.length} task{groupTasks.length === 1 ? "" : "s"} · {pct}% complete
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        hasActive
                          ? "bg-[var(--c-green)]/10 text-[var(--c-green)]"
                          : "bg-black/5 text-[#4d574f]"
                      }`}
                    >
                      {hasActive ? "Active" : "Done"}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                  <div className="h-full bg-[var(--c-green-light)]" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
          {activeGroupValues.length === 0 && (
            <p className="text-sm text-[#a39d8c] text-center py-10">No tasks to show yet.</p>
          )}
        </div>
      </div>

      {drill && drill.tasks.length > 0 && (
        <div className="rounded-xl border border-[var(--c-line)] bg-white p-3 shrink-0 flex flex-col" style={{ height: 340 }}>
          <div className="flex items-center justify-between mb-2 shrink-0">
            <p className="text-xs font-medium text-[#4d574f] font-display">
              Tasks — {drill.label} ({drill.tasks.length})
            </p>
            <button
              onClick={() => setDrill(null)}
              className="text-[#a39d8c] hover:text-[var(--c-ink)] text-xs"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <TaskListView
              tasks={drill.tasks}
              resources={resources}
              projects={projects}
              onOpenTask={onOpenTask}
              onDeleteTask={async () => {}}
              canDelete={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
