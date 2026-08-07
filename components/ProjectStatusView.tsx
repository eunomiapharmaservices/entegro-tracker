"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, AlertTriangle } from "lucide-react";
import { Project, Resource, STATUS_LABELS, STATUS_ORDER, Status, Task } from "@/lib/types";
import { fmtFull, isOverdue, effectiveDueDate } from "@/lib/dateUtils";
import { downloadCSV } from "@/lib/csvImport";

type SortKey = "name" | "sdd" | "total" | "done" | "overdue" | "progress" | "next_due";

interface ProjectStats {
  project: Project;
  tasks: Task[];
  total: number;
  done: number;
  overdue: number;
  progress: number;
  byStatus: Record<Status, number>;
  nextDue: string | null;
  people: string[];
}

export default function ProjectStatusView({
  tasks,
  resources,
  projects,
  onSelectProject,
}: {
  tasks: Task[];
  resources: Resource[];
  projects: Project[];
  onSelectProject: (projectId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("overdue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const stats: ProjectStats[] = useMemo(() => {
    // Top-level, non-deleted tasks only — matching how totals are counted
    // everywhere else in the app.
    const countable = tasks.filter((t) => !t.parent_task_id && !t.deleted_at);
    return projects
      .filter((p) => showArchived || !p.archived)
      .map((p) => {
        const mine = countable.filter((t) => t.project_id === p.id);
        const done = mine.filter((t) => t.status === "done").length;
        const overdue = mine.filter((t) =>
          isOverdue(effectiveDueDate(t.due_date, t.status, t.hold_started_at), t.status)
        ).length;

        const byStatus = STATUS_ORDER.reduce((acc, s) => {
          acc[s] = mine.filter((t) => t.status === s).length;
          return acc;
        }, {} as Record<Status, number>);

        // Soonest due date among work that isn't finished yet.
        const nextDue =
          mine
            .filter((t) => t.status !== "done" && t.due_date)
            .map((t) => effectiveDueDate(t.due_date, t.status, t.hold_started_at)!)
            .sort()[0] ?? null;

        const peopleIds = new Set<string>();
        for (const t of mine) {
          if (t.status === "done") continue;
          const ids = t.assignee_ids?.length ? t.assignee_ids : t.assigned_to ? [t.assigned_to] : [];
          ids.forEach((id) => peopleIds.add(id));
        }
        const people = [...peopleIds]
          .map((id) => resources.find((r) => r.id === id)?.name)
          .filter((n): n is string => !!n)
          .sort();

        return {
          project: p,
          tasks: mine,
          total: mine.length,
          done,
          overdue,
          progress: mine.length ? Math.round((done / mine.length) * 100) : 0,
          byStatus,
          nextDue,
          people,
        };
      });
  }, [tasks, projects, resources, showArchived]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stats;
    return stats.filter(
      (s) =>
        s.project.name.toLowerCase().includes(q) ||
        (s.project.eid || "").toLowerCase().includes(q) ||
        (s.project.site_name || "").toLowerCase().includes(q)
    );
  }, [stats, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.project.name.localeCompare(b.project.name, undefined, { numeric: true });
          break;
        case "sdd":
          cmp = (a.project.site_dark_date || "").localeCompare(b.project.site_dark_date || "");
          break;
        case "next_due":
          cmp = (a.nextDue || "").localeCompare(b.nextDue || "");
          break;
        case "total":
          cmp = a.total - b.total;
          break;
        case "done":
          cmp = a.done - b.done;
          break;
        case "overdue":
          cmp = a.overdue - b.overdue;
          break;
        case "progress":
          cmp = a.progress - b.progress;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function handleExport() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ["Project", "EID", "Site", "SDD", "Total", "Active", "Completed", "Overdue", "Progress %", "Next due", "People"].join(","),
      ...sorted.map((s) =>
        [
          esc(s.project.name),
          esc(s.project.eid || ""),
          esc(s.project.site_name || ""),
          esc(s.project.site_dark_date || ""),
          s.total,
          s.total - s.done,
          s.done,
          s.overdue,
          s.progress,
          esc(s.nextDue || ""),
          esc(s.people.join("; ")),
        ].join(",")
      ),
    ];
    downloadCSV(`project-status-${new Date().toISOString().slice(0, 10)}.csv`, rows.join("\n"));
  }

  // Roll-up figures across everything currently shown.
  const totals = useMemo(
    () => ({
      projects: sorted.length,
      tasks: sorted.reduce((n, s) => n + s.total, 0),
      done: sorted.reduce((n, s) => n + s.done, 0),
      overdue: sorted.reduce((n, s) => n + s.overdue, 0),
      atRisk: sorted.filter((s) => s.overdue > 0).length,
    }),
    [sorted]
  );

  const SortHead = ({ label, k, right }: { label: string; k: SortKey; right?: boolean }) => (
    <th
      className={`px-3 py-2 border-b border-[var(--c-line)] font-display font-medium text-[#4d574f] whitespace-nowrap ${
        right ? "text-right" : "text-left"
      }`}
    >
      <button
        onClick={() => toggleSort(k)}
        className={`flex items-center gap-1 hover:text-[var(--c-green)] ${right ? "ml-auto" : ""}`}
      >
        {label}
        {sortKey === k ? (
          sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
        ) : (
          <ArrowUpDown size={11} className="text-[#c9c2b2]" />
        )}
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* Roll-up cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {[
          { label: "Projects", value: totals.projects, color: "#1F5C4A", sub: "Currently shown" },
          { label: "Open tasks", value: totals.tasks - totals.done, color: "#3B6E8F", sub: `${totals.tasks} total` },
          { label: "Completed", value: totals.done, color: "#2E8B6F", sub: "Across these projects" },
          { label: "Projects at risk", value: totals.atRisk, color: "#C23B3B", sub: `${totals.overdue} overdue tasks` },
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

      <div className="rounded-xl border border-[var(--c-line)] bg-white flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--c-line)] shrink-0 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project, EID, site…"
            className="flex-1 min-w-[180px] max-w-xs rounded-lg border border-[var(--c-line)] px-3 py-1.5 text-sm bg-white outline-none focus:border-[var(--c-green)]"
          />
          <label className="flex items-center gap-1.5 text-xs text-[#8a8578] cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="accent-[var(--c-green)]"
            />
            Include archived
          </label>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-white border border-[var(--c-line)] hover:bg-black/5 ml-auto"
          >
            <Download size={12} />
            Export CSV
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <table className="text-sm border-collapse w-full">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <SortHead label="Project" k="name" />
                <SortHead label="SDD" k="sdd" />
                <th className="text-left px-3 py-2 border-b border-[var(--c-line)] font-display font-medium text-[#4d574f] whitespace-nowrap">
                  Breakdown
                </th>
                <SortHead label="Progress" k="progress" />
                <SortHead label="Open" k="total" right />
                <SortHead label="Done" k="done" right />
                <SortHead label="Overdue" k="overdue" right />
                <SortHead label="Next due" k="next_due" />
                <th className="text-left px-3 py-2 border-b border-[var(--c-line)] font-display font-medium text-[#4d574f] whitespace-nowrap">
                  People
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr
                  key={s.project.id}
                  onClick={() => onSelectProject(s.project.id)}
                  className="cursor-pointer hover:bg-black/[0.02] border-b border-[var(--c-line)]"
                  title="Open the board filtered to this project"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: s.project.color }}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {s.project.name}
                          {s.project.archived && (
                            <span className="text-[10px] text-[#a39d8c] font-normal"> (archived)</span>
                          )}
                        </p>
                        {(s.project.eid || s.project.site_name) && (
                          <p className="text-[10px] text-[#a39d8c] truncate">
                            {[s.project.site_name, s.project.eid ? `#${s.project.eid}` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-[var(--c-orange)]">
                    {s.project.site_dark_date ? fmtFull(s.project.site_dark_date) : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {s.total === 0 ? (
                      <span className="text-xs text-[#c9c2b2]">No tasks</span>
                    ) : (
                      <div className="flex items-center gap-1 flex-wrap">
                        {STATUS_ORDER.filter((st) => s.byStatus[st] > 0).map((st) => (
                          <span
                            key={st}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 text-[#4d574f] whitespace-nowrap"
                          >
                            {STATUS_LABELS[st]} {s.byStatus[st]}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 min-w-[110px]">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-black/[0.06] overflow-hidden min-w-[50px]">
                        <div
                          className="h-full bg-[var(--c-green-light)]"
                          style={{ width: `${s.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-[#8a8578] font-mono shrink-0">
                        {s.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">{s.total - s.done}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-[#a39d8c]">
                    {s.done}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">
                    {s.overdue > 0 ? (
                      <span className="text-[#C23B3B] font-semibold inline-flex items-center gap-1">
                        <AlertTriangle size={11} />
                        {s.overdue}
                      </span>
                    ) : (
                      <span className="text-[#c9c2b2]">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-[#8a8578]">
                    {s.nextDue ? fmtFull(s.nextDue) : "—"}
                  </td>
                  <td className="px-3 py-2.5 max-w-[180px]">
                    <span className="text-xs text-[#4d574f] truncate block" title={s.people.join(", ")}>
                      {s.people.length ? s.people.join(", ") : "—"}
                    </span>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#a39d8c]">
                    {stats.length === 0 ? "No projects yet." : "No projects match that search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
