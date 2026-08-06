"use client";

import { useState } from "react";
import { X, Building2 } from "lucide-react";
import { Project } from "@/lib/types";

export default function ManageProjectsModal({
  projects,
  onClose,
  onUpdate,
}: {
  projects: Project[];
  onClose: () => void;
  onUpdate: (id: string, input: Partial<Project>) => Promise<Project>;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { eid: string; site_name: string; site_dark_date: string }>
  >({});

  const sorted = [...projects].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
  );

  function draftFor(p: Project) {
    return (
      drafts[p.id] ?? {
        eid: p.eid ?? "",
        site_name: p.site_name ?? "",
        site_dark_date: p.site_dark_date ?? "",
      }
    );
  }

  function setDraft(id: string, field: "eid" | "site_name" | "site_dark_date", value: string) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...draftFor(projects.find((p) => p.id === id)!), ...prev[id], [field]: value },
    }));
  }

  async function handleSave(p: Project) {
    const draft = draftFor(p);
    setSavingId(p.id);
    try {
      await onUpdate(p.id, {
        eid: draft.eid.trim() || null,
        site_name: draft.site_name.trim() || null,
        site_dark_date: draft.site_dark_date || null,
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

  function isDirty(p: Project) {
    const d = draftFor(p);
    return (
      d.eid !== (p.eid ?? "") ||
      d.site_name !== (p.site_name ?? "") ||
      d.site_dark_date !== (p.site_dark_date ?? "")
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 overflow-y-auto py-10"
      onClick={onClose}
    >
      <div
        className="bg-[var(--c-cream)] rounded-2xl w-full max-w-2xl shadow-2xl border border-[var(--c-line)] p-6"
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
          EID, Site Name, and Site Dark Date (SDD) for each project — Admin/Super only.
          SDD shows on the header of every task in that project.
        </p>

        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-[var(--c-cream)]">
              <tr className="text-left text-xs text-[#8a8578] font-display">
                <th className="py-2 pr-2 font-medium">Project</th>
                <th className="py-2 px-2 font-medium">EID</th>
                <th className="py-2 px-2 font-medium">Site name</th>
                <th className="py-2 px-2 font-medium">SDD</th>
                <th className="py-2 pl-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const d = draftFor(p);
                const dirty = isDirty(p);
                return (
                  <tr key={p.id} className="border-t border-[var(--c-line)]">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: p.color }}
                        />
                        <span className="truncate">{p.name}</span>
                        {p.archived && (
                          <span className="text-[10px] text-[#a39d8c] shrink-0">(archived)</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        value={d.eid}
                        onChange={(e) => setDraft(p.id, "eid", e.target.value)}
                        placeholder="—"
                        className="w-24 rounded-md border border-[var(--c-line)] px-2 py-1 text-xs bg-white outline-none focus:border-[var(--c-green)]"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        value={d.site_name}
                        onChange={(e) => setDraft(p.id, "site_name", e.target.value)}
                        placeholder="—"
                        className="w-32 rounded-md border border-[var(--c-line)] px-2 py-1 text-xs bg-white outline-none focus:border-[var(--c-green)]"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="date"
                        value={d.site_dark_date}
                        onChange={(e) => setDraft(p.id, "site_dark_date", e.target.value)}
                        className="rounded-md border border-[var(--c-line)] px-2 py-1 text-xs bg-white outline-none focus:border-[var(--c-green)]"
                      />
                    </td>
                    <td className="py-2 pl-2">
                      {dirty && (
                        <button
                          onClick={() => handleSave(p)}
                          disabled={savingId === p.id}
                          className="text-xs px-2.5 py-1 rounded-md bg-[var(--c-green)] text-white hover:bg-[#194a3b] disabled:opacity-50"
                        >
                          {savingId === p.id ? "Saving…" : "Save"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#a39d8c]">
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
