"use client";

import { useMemo, useState } from "react";
import { Flag, AlertTriangle, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Project, Resource, STATUS_LABELS, Status, Task } from "@/lib/types";
import { fmt, fmtFull, isOverdue, effectiveDueDate } from "@/lib/dateUtils";
import { downloadCSV } from "@/lib/csvImport";
import TaskTitle from "./TaskTitle";

const STATUS_DOT: Record<string, string> = {
  todo: "#a39d8c",
  in_progress: "#3B6E8F",
  on_hold: "#E07A3E",
  review: "#8A5FB0",
  gcr: "#2E8B6F",
  done: "#1F5C4A",
};

// Overall project progress is a weighted roll-up of five components. Two are
// read from task status, three from the counters entered in Manage projects.
const PROGRESS_WEIGHTS = [
  { key: "audit", label: "Audit", weight: 10, source: "Audit task" },
  { key: "mrp", label: "MRP Planning", weight: 10, source: "MRP Planning task" },
  { key: "cleanse", label: "Data Cleanse", weight: 10, source: "Manage projects" },
  { key: "migration", label: "Migration", weight: 60, source: "Manage projects" },
  { key: "decom", label: "Node Decom", weight: 10, source: "Manage projects" },
] as const;

function ratio(done: number, required: number): number {
  if (!required || required <= 0) return 0;
  return Math.min(1, Math.max(0, done / required));
}

// A task-driven component counts as complete when its task is done, and
// otherwise contributes its own progress figure.
function taskComponent(tasks: Task[], typeName: string): number {
  const matches = tasks.filter(
    (t) => (t.task_type || "").trim().toLowerCase() === typeName.toLowerCase()
  );
  if (matches.length === 0) return 0;
  const total = matches.reduce(
    (sum, t) => sum + (t.status === "done" ? 100 : t.progress_percent || 0),
    0
  );
  return Math.min(1, total / (matches.length * 100));
}

function componentBreakdown(project: Project, projectTasks: Task[]) {
  const values: Record<string, number> = {
    audit: taskComponent(projectTasks, "Audit"),
    mrp: taskComponent(projectTasks, "MRP Planning"),
    cleanse: ratio(project.data_cleanse_complete, project.data_cleanse_required),
    migration: ratio(
      (project.migration_complete ?? 0) + (project.rings_migrated ?? 0),
      (project.migration_required ?? 0) + (project.total_rings ?? 0)
    ),
    decom: ratio(project.total_decommissioned, project.total_devices),
  };
  const overall = PROGRESS_WEIGHTS.reduce(
    (sum, w) => sum + values[w.key] * w.weight,
    0
  );
  return { values, overall: Math.round(overall) };
}

export default function ProjectStatusView({
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
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Top-level, non-deleted tasks only — matching how totals are counted
  // everywhere else in the app.
  const countable = useMemo(
    () => tasks.filter((t) => !t.parent_task_id && !t.deleted_at),
    [tasks]
  );

  function assigneeNames(t: Task): string {
    const ids = t.assignee_ids?.length ? t.assignee_ids : t.assigned_to ? [t.assigned_to] : [];
    return ids
      .map((id) => resources.find((r) => r.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  }

  const cards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects
      .filter((p) => showArchived || !p.archived)
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.eid || "").toLowerCase().includes(q) ||
          (p.site_name || "").toLowerCase().includes(q) ||
          (p.mrp_planner || "").toLowerCase().includes(q) ||
          (p.ip_tech || "").toLowerCase().includes(q)
      )
      .map((p) => {
        const mine = countable.filter((t) => t.project_id === p.id);
        const done = mine.filter((t) => t.status === "done").length;
        const overdue = mine.filter((t) =>
          isOverdue(effectiveDueDate(t.due_date, t.status, t.hold_started_at), t.status)
        ).length;
        const visible = showCompleted ? mine : mine.filter((t) => t.status !== "done");

        // Group the visible tasks by status so the card reads like a summary
        // rather than a flat list.
        const byStatus = new Map<Status, Task[]>();
        for (const t of visible) {
          if (!byStatus.has(t.status)) byStatus.set(t.status, []);
          byStatus.get(t.status)!.push(t);
        }
        const groups = [...byStatus.entries()].sort(
          (a, b) => STATUS_SORT.indexOf(a[0]) - STATUS_SORT.indexOf(b[0])
        );

        const nextDue =
          mine
            .filter((t) => t.status !== "done" && t.due_date)
            .map((t) => effectiveDueDate(t.due_date, t.status, t.hold_started_at)!)
            .sort()[0] ?? null;

        return {
          project: p,
          total: mine.length,
          done,
          overdue,
          progress: componentBreakdown(p, mine).overall,
          breakdown: componentBreakdown(p, mine).values,
          groups,
          nextDue,
        };
      })
      .sort((a, b) => {
        // Soonest Site Dark Date first — projects without an SDD sort last
        // rather than jumping to the front on an empty string.
        const aSdd = a.project.site_dark_date || "";
        const bSdd = b.project.site_dark_date || "";
        if (aSdd && !bSdd) return -1;
        if (!aSdd && bSdd) return 1;
        if (aSdd !== bSdd) return aSdd.localeCompare(bSdd);
        return a.project.name.localeCompare(b.project.name, undefined, { numeric: true });
      });
  }, [projects, countable, search, showArchived, showCompleted]);

  const totals = useMemo(
    () => ({
      projects: cards.length,
      open: cards.reduce((n, c) => n + (c.total - c.done), 0),
      done: cards.reduce((n, c) => n + c.done, 0),
      atRisk: cards.filter((c) => c.overdue > 0).length,
      overdue: cards.reduce((n, c) => n + c.overdue, 0),
    }),
    [cards]
  );

  function handleExport() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ["Project", "EID", "Site", "SDD", "MRP Planner", "IP Tech", "Total", "Open", "Completed", "Overdue", "Progress %", "Next due"].join(","),
      ...cards.map((c) =>
        [
          esc(c.project.name),
          esc(c.project.eid || ""),
          esc(c.project.site_name || ""),
          esc(c.project.site_dark_date || ""),
          esc(c.project.mrp_planner || ""),
          esc(c.project.ip_tech || ""),
          c.total,
          c.total - c.done,
          c.done,
          c.overdue,
          c.progress,
          esc(c.nextDue || ""),
        ].join(",")
      ),
    ];
    downloadCSV(`project-status-${new Date().toISOString().slice(0, 10)}.csv`, rows.join("\n"));
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* Roll-up cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {[
          { label: "Projects", value: totals.projects, color: "#1F5C4A", sub: "Currently shown" },
          { label: "Open tasks", value: totals.open, color: "#3B6E8F", sub: "Not yet completed" },
          { label: "Completed", value: totals.done, color: "#2E8B6F", sub: "Across these projects" },
          {
            label: "Projects at risk",
            value: totals.atRisk,
            color: "#C23B3B",
            sub: `${totals.overdue} overdue task${totals.overdue === 1 ? "" : "s"}`,
          },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-[var(--c-line)] bg-white p-4">
            <p className="text-xs font-medium text-[#8a8578] mb-1.5">{m.label}</p>
            <p className="font-display font-semibold text-2xl" style={{ color: m.color }}>
              {m.value}
            </p>
            <p className="text-[11px] text-[#a39d8c] mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search project, EID, site…"
          className="flex-1 min-w-[180px] max-w-xs rounded-lg border border-[var(--c-line)] px-3 py-1.5 text-sm bg-white outline-none focus:border-[var(--c-green)]"
        />
        <label className="flex items-center gap-1.5 text-xs text-[#8a8578] cursor-pointer">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="accent-[var(--c-green)]"
          />
          Show completed tasks
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[#8a8578] cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="accent-[var(--c-green)]"
          />
          Include archived projects
        </label>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-white border border-[var(--c-line)] hover:bg-black/5 ml-auto"
        >
          <Download size={12} />
          Export CSV
        </button>
      </div>

      {/* Project cards */}
      <div className="overflow-y-auto flex-1 min-h-0 pr-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cards.map((c) => (
            <div
              key={c.project.id}
              className="rounded-xl border border-[var(--c-line)] bg-white p-4 flex flex-col gap-3"
            >
              {/* Header */}
              <button
                onClick={() =>
                  setExpandedId((prev) => (prev === c.project.id ? null : c.project.id))
                }
                className="flex items-start gap-3 text-left w-full"
                title="Show project figures"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 mt-1"
                  style={{ background: c.project.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-sm truncate">
                    {c.project.name}
                    {c.project.archived && (
                      <span className="text-[10px] text-[#a39d8c] font-normal"> (archived)</span>
                    )}
                  </p>
                  <p className="text-xs text-[#8a8578]">
                    {c.total - c.done} open · {c.done} done
                    {c.overdue > 0 && (
                      <span className="text-[#C23B3B] font-medium"> · {c.overdue} overdue</span>
                    )}
                  </p>
                  {(c.project.site_name || c.project.eid || c.project.site_dark_date) && (
                    <p className="text-[10px] text-[#a39d8c] mt-0.5">
                      {[
                        c.project.site_name,
                        c.project.eid ? `#${c.project.eid}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {c.project.site_dark_date && (
                        <span className="text-[var(--c-orange)]">
                          {c.project.site_name || c.project.eid ? " · " : ""}
                          SDD {fmtFull(c.project.site_dark_date)}
                        </span>
                      )}
                    </p>
                  )}
                  {(c.project.mrp_planner || c.project.ip_tech) && (
                    <p className="text-[10px] text-[#8a8578] mt-0.5">
                      {c.project.mrp_planner && (
                        <>
                          <span className="text-[#a39d8c]">MRP </span>
                          <span className="font-semibold text-[#3B6E8F]">
                            {c.project.mrp_planner}
                          </span>
                        </>
                      )}
                      {c.project.mrp_planner && c.project.ip_tech && " · "}
                      {c.project.ip_tech && (
                        <>
                          <span className="text-[#a39d8c]">IP Tech </span>
                          <span className="font-semibold text-[#8A5FB0]">
                            {c.project.ip_tech}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                </div>
                {c.overdue > 0 && (
                  <AlertTriangle size={15} className="text-[#C23B3B] shrink-0 mt-0.5" />
                )}
                {expandedId === c.project.id ? (
                  <ChevronUp size={15} className="text-[#a39d8c] shrink-0 mt-0.5" />
                ) : (
                  <ChevronDown size={15} className="text-[#a39d8c] shrink-0 mt-0.5" />
                )}
              </button>

              {expandedId === c.project.id && (
                <div className="grid grid-cols-3 gap-x-3 gap-y-2 rounded-lg bg-black/[0.02] p-3 -mt-1">
                  {[
                    { label: "Total Circuits", value: c.project.total_circuits },
                    { label: "Migration Req", value: c.project.migration_required },
                    { label: "Migration Done", value: c.project.migration_complete },
                    { label: "Total Rings", value: c.project.total_rings },
                    { label: "Rings Migrated", value: c.project.rings_migrated },
                    { label: "Cleanse Req", value: c.project.data_cleanse_required },
                    { label: "Cleanse Done", value: c.project.data_cleanse_complete },
                    { label: "Total Devices", value: c.project.total_devices },
                    { label: "Decommissioned", value: c.project.total_decommissioned },
                  ].map((m) => (
                    <div key={m.label}>
                      <p className="text-[10px] text-[#a39d8c] truncate">{m.label}</p>
                      <p className="font-mono text-sm text-[#4d574f]">{m.value ?? 0}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress */}
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-black/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-[var(--c-green-light)]"
                    style={{ width: `${c.progress}%` }}
                  />
                </div>
                <span className="text-[11px] text-[#8a8578] font-mono shrink-0">
                  {c.progress}%
                </span>
              </div>

              {/* What the overall % is made of */}
              <div className="flex flex-col gap-1">
                {PROGRESS_WEIGHTS.map((w) => {
                  const v = c.breakdown[w.key] ?? 0;
                  return (
                    <div key={w.key} className="flex items-center gap-2 text-[11px]">
                      <span className="text-[#4d574f] w-24 shrink-0 truncate" title={`From ${w.source}`}>
                        {w.label}
                      </span>
                      <span className="text-[#c9c2b2] shrink-0 font-mono">{w.weight}%</span>
                      <div className="h-1 flex-1 rounded-full bg-black/[0.06] overflow-hidden min-w-[40px]">
                        <div
                          className={v >= 1 ? "h-full bg-[var(--c-green)]" : "h-full bg-[var(--c-green)]/60"}
                          style={{ width: `${Math.round(v * 100)}%` }}
                        />
                      </div>
                      <span
                        className={`font-mono shrink-0 w-8 text-right ${
                          v >= 1
                            ? "text-[var(--c-green)] font-semibold"
                            : "text-[#a39d8c]"
                        }`}
                      >
                        {Math.round(v * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>

              {c.nextDue && (
                <p className="text-[11px] text-[#8a8578] -mt-1">
                  Next due <span className="font-medium">{fmtFull(c.nextDue)}</span>
                </p>
              )}

              {/* Tasks grouped by status */}
              {c.groups.length === 0 ? (
                <p className="text-xs text-[#c9c2b2]">
                  {c.total === 0 ? "No tasks in this project." : "No open tasks."}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {c.groups.map(([status, statusTasks]) => (
                    <div key={status}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: STATUS_DOT[status] }}
                        />
                        <span className="text-xs font-medium text-[#4d574f] font-display">
                          {STATUS_LABELS[status]}
                        </span>
                        <span className="text-[10px] text-[#a39d8c]">({statusTasks.length})</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {statusTasks.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => onOpenTask(t)}
                            className="flex items-center gap-2 text-left px-2 py-1.5 rounded-md hover:bg-black/[0.03] text-sm"
                          >
                            {t.is_milestone && (
                              <Flag
                                size={10}
                                className="text-[var(--c-orange)] shrink-0"
                                fill="currentColor"
                              />
                            )}
                            <span className="truncate flex-1">
                              <TaskTitle task={t} />
                            </span>
                            {assigneeNames(t) && (
                              <span className="text-[11px] text-[#a39d8c] shrink-0 max-w-[90px] truncate">
                                {assigneeNames(t)}
                              </span>
                            )}
                            {t.due_date && (
                              <span
                                className={`text-[11px] shrink-0 ${
                                  isOverdue(
                                    effectiveDueDate(t.due_date, t.status, t.hold_started_at),
                                    t.status
                                  )
                                    ? "text-[#C23B3B] font-medium"
                                    : "text-[#a39d8c]"
                                }`}
                              >
                                {fmt(effectiveDueDate(t.due_date, t.status, t.hold_started_at))}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {cards.length === 0 && (
          <p className="text-sm text-[#a39d8c] text-center py-12">
            {projects.length === 0 ? "No projects yet." : "No projects match that search."}
          </p>
        )}
      </div>
    </div>
  );
}

// Order statuses appear within a project card.
const STATUS_SORT: Status[] = ["on_hold", "review", "gcr", "in_progress", "todo", "done"];
