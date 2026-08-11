"use client";

import { useMemo, useState } from "react";
import { Trash2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Project, Resource, Task } from "@/lib/types";

type SortKey = "name" | "site_dark_date" | "mrp_planner" | "ip_tech" | "active" | "completed";

export default function ManageProjectsModal({
  projects,
  tasks,
  resources,
  onUpdate,
  onDelete,
}: {
  projects: Project[];
  tasks: Task[];
  resources: Resource[];
  onUpdate: (id: string, input: Partial<Project>) => Promise<Project>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<
      string,
      { name: string; site_dark_date: string; mrp_planner: string; ip_tech: string } & Record<string, string>
    >
  >({});

  const [search, setSearch] = useState("");
  const [mrpFilter, setMrpFilter] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const [showArchived, setShowArchived] = useState(true);
  const [onlyWithTasks, setOnlyWithTasks] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Counts are top-level, non-deleted tasks only — matching how totals are
  // presented everywhere else in the app.
  const countable = useMemo(
    () => tasks.filter((t) => !t.parent_task_id && !t.deleted_at),
    [tasks]
  );

  function counts(projectId: string) {
    const mine = countable.filter((t) => t.project_id === projectId);
    return {
      active: mine.filter((t) => t.status !== "done").length,
      completed: mine.filter((t) => t.status === "done").length,
      total: mine.length,
    };
  }

  function draftFor(p: Project) {
    return (
      drafts[p.id] ?? {
        name: p.name,
        site_dark_date: p.site_dark_date ?? "",
        mrp_planner: p.mrp_planner ?? "",
        ip_tech: p.ip_tech ?? "",
        total_circuits: String(p.total_circuits ?? 0),
        migration_required: String(p.migration_required ?? 0),
        migration_complete: String(p.migration_complete ?? 0),
        data_cleanse_required: String(p.data_cleanse_required ?? 0),
        data_cleanse_complete: String(p.data_cleanse_complete ?? 0),
        total_devices: String(p.total_devices ?? 0),
        total_decommissioned: String(p.total_decommissioned ?? 0),
      }
    );
  }

  function setDraft(
    p: Project,
    field: string,
    value: string
  ) {
    setDrafts((prev) => ({ ...prev, [p.id]: { ...draftFor(p), ...prev[p.id], [field]: value } }));
  }

  function isDirty(p: Project) {
    const d = draftFor(p);
    return (
      d.name !== p.name ||
      d.site_dark_date !== (p.site_dark_date ?? "") ||
      d.mrp_planner !== (p.mrp_planner ?? "") ||
      d.ip_tech !== (p.ip_tech ?? "") ||
      d.total_circuits !== String(p.total_circuits ?? 0) ||
      d.migration_required !== String(p.migration_required ?? 0) ||
      d.migration_complete !== String(p.migration_complete ?? 0) ||
      d.data_cleanse_required !== String(p.data_cleanse_required ?? 0) ||
      d.data_cleanse_complete !== String(p.data_cleanse_complete ?? 0) ||
      d.total_devices !== String(p.total_devices ?? 0) ||
      d.total_decommissioned !== String(p.total_decommissioned ?? 0)
    );
  }

  async function handleSave(p: Project) {
    const d = draftFor(p);
    if (!d.name.trim()) {
      alert("Project name can't be empty.");
      return;
    }
    setSavingId(p.id);
    try {
      await onUpdate(p.id, {
        name: d.name.trim(),
        site_dark_date: d.site_dark_date || null,
        mrp_planner: d.mrp_planner.trim() || null,
        ip_tech: d.ip_tech.trim() || null,
        total_circuits: Number(d.total_circuits) || 0,
        migration_required: Number(d.migration_required) || 0,
        migration_complete: Number(d.migration_complete) || 0,
        data_cleanse_required: Number(d.data_cleanse_required) || 0,
        data_cleanse_complete: Number(d.data_cleanse_complete) || 0,
        total_devices: Number(d.total_devices) || 0,
        total_decommissioned: Number(d.total_decommissioned) || 0,
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
    } catch (err) {
      alert(`Couldn't save: ${(err as Error).message || "unknown error"}`);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(p: Project) {
    if (counts(p.id).total > 0) return;
    if (!confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    setDeletingId(p.id);
    try {
      await onDelete(p.id);
    } catch (err) {
      alert(`Couldn't delete: ${(err as Error).message || "unknown error"}`);
    } finally {
      setDeletingId(null);
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = projects
      .filter((p) => showArchived || !p.archived)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .filter((p) => !mrpFilter || (p.mrp_planner ?? "") === mrpFilter)
      .filter((p) => !ipFilter || (p.ip_tech ?? "") === ipFilter)
      .filter((p) => !onlyWithTasks || counts(p.id).total > 0);

    return rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
          break;
        case "site_dark_date":
          cmp = (a.site_dark_date || "").localeCompare(b.site_dark_date || "");
          break;
        case "mrp_planner":
          cmp = (a.mrp_planner || "").localeCompare(b.mrp_planner || "");
          break;
        case "ip_tech":
          cmp = (a.ip_tech || "").localeCompare(b.ip_tech || "");
          break;
        case "active":
          cmp = counts(a.id).active - counts(b.id).active;
          break;
        case "completed":
          cmp = counts(a.id).completed - counts(b.id).completed;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, search, mrpFilter, ipFilter, showArchived, onlyWithTasks, sortKey, sortDir, countable]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Offer existing values plus everyone in People, so these stay consistent
  // without forcing a fixed list.
  const peopleNames = useMemo(() => {
    const set = new Set<string>(resources.map((r) => r.name));
    projects.forEach((p) => {
      if (p.mrp_planner) set.add(p.mrp_planner);
      if (p.ip_tech) set.add(p.ip_tech);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [resources, projects]);

  const mrpValues = useMemo(
    () => [...new Set(projects.map((p) => p.mrp_planner).filter((v): v is string => !!v))].sort(),
    [projects]
  );
  const ipValues = useMemo(
    () => [...new Set(projects.map((p) => p.ip_tech).filter((v): v is string => !!v))].sort(),
    [projects]
  );

  const cellInput =
    "rounded-md border border-[var(--c-line)] px-2 py-1 text-xs bg-white outline-none focus:border-[var(--c-green)]";
  const filterCls =
    "rounded-lg border border-[var(--c-line)] px-2 py-1.5 text-xs bg-white outline-none focus:border-[var(--c-green)]";

  const SortHead = ({ label, k, right }: { label: string; k: SortKey; right?: boolean }) => (
    <th className={`py-2 px-2 font-medium ${right ? "text-right" : "text-left"}`}>
      <button
        onClick={() => toggleSort(k)}
        className={`flex items-center gap-1 hover:text-[var(--c-green)] ${right ? "ml-auto" : ""}`}
      >
        {label}
        {sortKey === k ? (
          sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />
        ) : (
          <ArrowUpDown size={10} className="text-[#c9c2b2]" />
        )}
      </button>
    </th>
  );

  return (
    <div className="rounded-xl border border-[var(--c-line)] bg-white h-full flex flex-col overflow-hidden">
      <div className="p-4 flex flex-col min-h-0 flex-1">
        <p className="text-xs text-[#8a8578] mb-3">
          Name, SDD, owners, and circuit/migration/decommission counts for each project. SDD shows at the top of
          every task in that project. A project can only be deleted once it has no tasks
          left.
        </p>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project name…"
            className={filterCls + " flex-1 min-w-[150px] max-w-[220px]"}
          />
          <select value={mrpFilter} onChange={(e) => setMrpFilter(e.target.value)} className={filterCls}>
            <option value="">All MRP Planners</option>
            {mrpValues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select value={ipFilter} onChange={(e) => setIpFilter(e.target.value)} className={filterCls}>
            <option value="">All IP Techs</option>
            {ipValues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-[#8a8578] cursor-pointer">
            <input
              type="checkbox"
              checked={onlyWithTasks}
              onChange={(e) => setOnlyWithTasks(e.target.checked)}
              className="accent-[var(--c-green)]"
            />
            Only with tasks
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#8a8578] cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="accent-[var(--c-green)]"
            />
            Include archived
          </label>
          <span className="text-[11px] text-[#a39d8c] ml-auto">
            {visible.length} of {projects.length}
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="text-left text-xs text-[#8a8578] font-display">
                <SortHead label="Project" k="name" />
                <SortHead label="SDD" k="site_dark_date" />
                <SortHead label="MRP Planner" k="mrp_planner" />
                <SortHead label="IP Tech" k="ip_tech" />
                <th className="py-2 px-2 font-medium text-right whitespace-nowrap">Total Circuits</th>
                <th className="py-2 px-2 font-medium text-right whitespace-nowrap">Migration Req</th>
                <th className="py-2 px-2 font-medium text-right whitespace-nowrap">Migration Done</th>
                <th className="py-2 px-2 font-medium text-right whitespace-nowrap">Cleanse Req</th>
                <th className="py-2 px-2 font-medium text-right whitespace-nowrap">Cleanse Done</th>
                <th className="py-2 px-2 font-medium text-right whitespace-nowrap">Total Devices</th>
                <th className="py-2 px-2 font-medium text-right whitespace-nowrap">Decommissioned</th>
                <SortHead label="Active" k="active" right />
                <SortHead label="Done" k="completed" right />
                <th className="py-2 pl-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const d = draftFor(p);
                const dirty = isDirty(p);
                const c = counts(p.id);
                const canDelete = c.total === 0;
                return (
                  <tr key={p.id} className="border-t border-[var(--c-line)]">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: p.color }}
                        />
                        <input
                          value={d.name}
                          onChange={(e) => setDraft(p, "name", e.target.value)}
                          className={cellInput + " w-36"}
                        />
                        {p.archived && (
                          <span className="text-[10px] text-[#a39d8c] shrink-0">(arch)</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="date"
                        value={d.site_dark_date}
                        onChange={(e) => setDraft(p, "site_dark_date", e.target.value)}
                        className={cellInput}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        list="people-names"
                        value={d.mrp_planner}
                        onChange={(e) => setDraft(p, "mrp_planner", e.target.value)}
                        placeholder="—"
                        className={cellInput + " w-28"}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        list="people-names"
                        value={d.ip_tech}
                        onChange={(e) => setDraft(p, "ip_tech", e.target.value)}
                        placeholder="—"
                        className={cellInput + " w-28"}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min={0}
                        value={d.total_circuits}
                        onChange={(e) => setDraft(p, "total_circuits", e.target.value)}
                        className={cellInput + " w-16 text-right"}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min={0}
                        value={d.migration_required}
                        onChange={(e) => setDraft(p, "migration_required", e.target.value)}
                        className={cellInput + " w-16 text-right"}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min={0}
                        value={d.migration_complete}
                        onChange={(e) => setDraft(p, "migration_complete", e.target.value)}
                        className={cellInput + " w-16 text-right"}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min={0}
                        value={d.data_cleanse_required}
                        onChange={(e) => setDraft(p, "data_cleanse_required", e.target.value)}
                        className={cellInput + " w-16 text-right"}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min={0}
                        value={d.data_cleanse_complete}
                        onChange={(e) => setDraft(p, "data_cleanse_complete", e.target.value)}
                        className={cellInput + " w-16 text-right"}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min={0}
                        value={d.total_devices}
                        onChange={(e) => setDraft(p, "total_devices", e.target.value)}
                        className={cellInput + " w-16 text-right"}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min={0}
                        value={d.total_decommissioned}
                        onChange={(e) => setDraft(p, "total_decommissioned", e.target.value)}
                        className={cellInput + " w-16 text-right"}
                      />
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-xs text-[var(--c-green)]">
                      {c.active}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-xs text-[#a39d8c]">
                      {c.completed}
                    </td>
                    <td className="py-2 pl-2">
                      <div className="flex items-center gap-2 justify-end">
                        {dirty && (
                          <button
                            onClick={() => handleSave(p)}
                            disabled={savingId === p.id}
                            className="text-xs px-2.5 py-1 rounded-md bg-[var(--c-green)] text-white hover:bg-[#194a3b] disabled:opacity-50 whitespace-nowrap"
                          >
                            {savingId === p.id ? "Saving…" : "Save"}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(p)}
                          disabled={!canDelete || deletingId === p.id}
                          title={
                            canDelete
                              ? `Delete ${p.name}`
                              : `Can't delete — ${c.total} task${c.total === 1 ? "" : "s"} still in this project`
                          }
                          className={`shrink-0 p-1 rounded ${
                            canDelete
                              ? "text-[#c9c2b2] hover:text-[#C23B3B]"
                              : "text-[#e7e2d8] cursor-not-allowed"
                          }`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-[#a39d8c]">
                    {projects.length === 0 ? "No projects yet." : "No projects match those filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <datalist id="people-names">
          {peopleNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
