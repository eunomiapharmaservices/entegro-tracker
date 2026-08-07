"use client";

import { useState } from "react";
import { X, Building2, Trash2 } from "lucide-react";
import { Project, Task } from "@/lib/types";

export default function ManageProjectsModal({
  projects,
  tasks,
  onClose,
  onUpdate,
  onDelete,
}: {
  projects: Project[];
  tasks: Task[];
  onClose: () => void;
  onUpdate: (id: string, input: Partial<Project>) => Promise<Project>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { name: string; eid: string; site_name: string; site_dark_date: string }>
  >({});

  const sorted = [...projects].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
  );

  // Counts are top-level, non-deleted tasks only — matching how totals are
  // presented everywhere else in the app.
  const countable = tasks.filter((t) => !t.parent_task_id && !t.deleted_at);
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
        eid: p.eid ?? "",
        site_name: p.site_name ?? "",
        site_dark_date: p.site_dark_date ?? "",
      }
    );
  }

  function setDraft(
    p: Project,
    field: "name" | "eid" | "site_name" | "site_dark_date",
    value: string
  ) {
    setDrafts((prev) => ({ ...prev, [p.id]: { ...draftFor(p), ...prev[p.id], [field]: value } }));
  }

  function isDirty(p: Project) {
    const d = draftFor(p);
    return (
      d.name !== p.name ||
      d.eid !== (p.eid ?? "") ||
      d.site_name !== (p.site_name ?? "") ||
      d.site_dark_date !== (p.site_dark_date ?? "")
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
        eid: d.eid.trim() || null,
        site_name: d.site_name.trim() || null,
        site_dark_date: d.site_dark_date || null,
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
    const { total } = counts(p.id);
    if (total > 0) return; // guarded in the UI too, but never rely on that alone
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

  const cellInput =
    "rounded-md border border-[var(--c-line)] px-2 py-1 text-xs bg-white outline-none focus:border-[var(--c-green)]";

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 overflow-y-auto py-10"
      onClick={onClose}
    >
      <div
        className="bg-[var(--c-cream)] rounded-2xl w-full max-w-3xl shadow-2xl border border-[var(--c-line)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-semibold text-base flex items-center gap-2">
            <Building2 size={17} className="text-[var(--c-green)]" />
            Manage projects
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-[#8a8578] mb-4">
          Name, EID, Site Name, and Site Dark Date (SDD) for each project. SDD shows at the
          top of every task in that project. A project can only be deleted once it has no
          tasks left.
        </p>

        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-[var(--c-cream)]">
              <tr className="text-left text-xs text-[#8a8578] font-display">
                <th className="py-2 pr-2 font-medium">Project</th>
                <th className="py-2 px-2 font-medium">EID</th>
                <th className="py-2 px-2 font-medium">Site name</th>
                <th className="py-2 px-2 font-medium">SDD</th>
                <th className="py-2 px-2 font-medium whitespace-nowrap">Tasks</th>
                <th className="py-2 pl-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
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
                          className={cellInput + " w-40"}
                        />
                        {p.archived && (
                          <span className="text-[10px] text-[#a39d8c] shrink-0">(archived)</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        value={d.eid}
                        onChange={(e) => setDraft(p, "eid", e.target.value)}
                        placeholder="—"
                        className={cellInput + " w-20"}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        value={d.site_name}
                        onChange={(e) => setDraft(p, "site_name", e.target.value)}
                        placeholder="—"
                        className={cellInput + " w-28"}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="date"
                        value={d.site_dark_date}
                        onChange={(e) => setDraft(p, "site_dark_date", e.target.value)}
                        className={cellInput}
                      />
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap text-xs">
                      <span className="text-[var(--c-green)] font-medium">{c.active} active</span>
                      <span className="text-[#a39d8c]"> · {c.completed} done</span>
                    </td>
                    <td className="py-2 pl-2">
                      <div className="flex items-center gap-2 justify-end">
                        {dirty && (
                          <button
                            onClick={() => handleSave(p)}
                            disabled={savingId === p.id}
                            className="text-xs px-2.5 py-1 rounded-md bg-[var(--c-green)] text-white hover:bg-[#194a3b] disabled:opacity-50"
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
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#a39d8c]">
                    No projects yet.
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
