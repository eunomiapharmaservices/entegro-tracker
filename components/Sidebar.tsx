"use client";

import { Plus, Trash2, Download, Archive, ArchiveRestore, ChevronDown, ChevronRight, LogOut } from "lucide-react";
import { LayoutGrid, Calendar as CalendarIcon, BarChart3, Users, List } from "lucide-react";
import { useState } from "react";
import { Project, Resource } from "@/lib/types";
import Avatar from "./Avatar";

export type ViewMode = "board" | "timeline" | "calendar" | "people" | "list";

export default function Sidebar({
  view,
  setView,
  projects,
  resources,
  activeProject,
  setActiveProject,
  activeResource,
  setActiveResource,
  onNewTask,
  onNewProject,
  onNewResource,
  onArchiveProject,
  onUnarchiveProject,
  onDeleteProjectPermanently,
  onDeleteResource,
  onExportProjects,
  onExportResources,
  currentUser,
  setCurrentUser,
  onSignOut,
}: {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  projects: Project[];
  resources: Resource[];
  activeProject: string | null;
  setActiveProject: (id: string | null) => void;
  activeResource: string | null;
  setActiveResource: (id: string | null) => void;
  onNewTask: () => void;
  onNewProject: () => void;
  onNewResource: () => void;
  onArchiveProject: (id: string, name: string) => void;
  onUnarchiveProject: (id: string, name: string) => void;
  onDeleteProjectPermanently: (id: string, name: string) => void;
  onDeleteResource: (id: string, name: string) => void;
  onExportProjects: () => void;
  onExportResources: () => void;
  currentUser: string;
  setCurrentUser: (name: string) => void;
  onSignOut: () => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const sortByName = (a: Project, b: Project) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  const activeProjects = projects.filter((p) => !p.archived).sort(sortByName);
  const archivedProjects = projects.filter((p) => p.archived).sort(sortByName);

  const navItems: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: "board", label: "Board", icon: <LayoutGrid size={17} /> },
    { key: "timeline", label: "Timeline", icon: <BarChart3 size={17} /> },
    { key: "calendar", label: "Calendar", icon: <CalendarIcon size={17} /> },
    { key: "list", label: "List", icon: <List size={17} /> },
    { key: "people", label: "People", icon: <Users size={17} /> },
  ];

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 border-r border-[var(--c-line)] flex flex-col bg-white/60">
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[var(--c-green)] flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-sm bg-[var(--c-orange)]" />
          </div>
          <span className="font-display font-semibold text-[15px] tracking-tight">
            Entegro Tracker
          </span>
        </div>
      </div>

      <button
        onClick={onNewTask}
        className="mx-5 mb-5 flex items-center justify-center gap-2 rounded-lg bg-[var(--c-green)] text-white text-sm font-medium py-2.5 hover:bg-[#194a3b] transition-colors"
      >
        <Plus size={16} /> New task
      </button>

      <nav className="px-3 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              view === item.key
                ? "bg-[var(--c-green)]/10 text-[var(--c-green)] font-medium"
                : "text-[#4d574f] hover:bg-black/5"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-5 mt-7">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[#8a8578]">
            Projects
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onExportProjects}
              title="Export projects as CSV"
              className="text-[#8a8578] hover:text-[var(--c-ink)]"
            >
              <Download size={13} />
            </button>
            <button
              onClick={onNewProject}
              title="Add project"
              className="text-[#8a8578] hover:text-[var(--c-ink)]"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => setActiveProject(null)}
            className={`text-left text-sm px-2 py-1.5 rounded-md flex items-center gap-2 ${
              activeProject === null ? "bg-black/5 font-medium" : "hover:bg-black/5 text-[#4d574f]"
            }`}
          >
            All projects
          </button>
          {activeProjects.map((p) => (
            <div
              key={p.id}
              className={`group flex items-center gap-1 rounded-md ${
                activeProject === p.id ? "bg-black/5" : "hover:bg-black/5"
              }`}
            >
              <button
                onClick={() => setActiveProject(p.id)}
                className={`flex-1 min-w-0 text-left text-sm px-2 py-1.5 rounded-md flex items-center gap-2 ${
                  activeProject === p.id ? "font-medium" : "text-[#4d574f]"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: p.color }}
                />
                <span className="truncate">{p.name}</span>
              </button>
              <button
                onClick={() => onArchiveProject(p.id, p.name)}
                title={`Archive ${p.name}`}
                className="shrink-0 mr-1 p-1 rounded text-[#c9c2b2] opacity-0 group-hover:opacity-100 hover:text-[var(--c-orange)] transition-opacity"
              >
                <Archive size={13} />
              </button>
            </div>
          ))}
        </div>

        {archivedProjects.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="flex items-center gap-1 text-xs text-[#a39d8c] hover:text-[#4d574f] px-2 py-1"
            >
              {showArchived ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Archived ({archivedProjects.length})
            </button>
            {showArchived && (
              <div className="flex flex-col gap-0.5 mt-1">
                {archivedProjects.map((p) => (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-1 rounded-md ${
                      activeProject === p.id ? "bg-black/5" : "hover:bg-black/5"
                    }`}
                  >
                    <button
                      onClick={() => setActiveProject(p.id)}
                      className="flex-1 min-w-0 text-left text-sm px-2 py-1.5 flex items-center gap-2 text-[#a39d8c]"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0 opacity-50"
                        style={{ background: p.color }}
                      />
                      <span className="truncate">{p.name}</span>
                    </button>
                    <button
                      onClick={() => onUnarchiveProject(p.id, p.name)}
                      title={`Restore ${p.name}`}
                      className="shrink-0 p-1 rounded text-[#c9c2b2] opacity-0 group-hover:opacity-100 hover:text-[var(--c-green)] transition-opacity"
                    >
                      <ArchiveRestore size={13} />
                    </button>
                    <button
                      onClick={() => onDeleteProjectPermanently(p.id, p.name)}
                      title={`Delete ${p.name} permanently`}
                      className="shrink-0 mr-1 p-1 rounded text-[#c9c2b2] opacity-0 group-hover:opacity-100 hover:text-[#C23B3B] transition-opacity"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-5 mt-7">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[#8a8578]">
            People
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onExportResources}
              title="Export people as CSV"
              className="text-[#8a8578] hover:text-[var(--c-ink)]"
            >
              <Download size={13} />
            </button>
            <button
              onClick={onNewResource}
              title="Add person"
              className="text-[#8a8578] hover:text-[var(--c-ink)]"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => setActiveResource(null)}
            className={`text-left text-sm px-2 py-1.5 rounded-md flex items-center gap-2 ${
              activeResource === null ? "bg-black/5 font-medium" : "hover:bg-black/5 text-[#4d574f]"
            }`}
          >
            Everyone
          </button>
          {resources.map((r) => (
            <div
              key={r.id}
              className={`group flex items-center gap-1 rounded-md ${
                activeResource === r.id ? "bg-black/5" : "hover:bg-black/5"
              }`}
            >
              <button
                onClick={() => setActiveResource(r.id)}
                className={`flex-1 min-w-0 text-left text-sm px-2 py-1.5 rounded-md flex items-center gap-2 ${
                  activeResource === r.id ? "font-medium" : "text-[#4d574f]"
                }`}
              >
                <Avatar resource={r} size={20} />
                <span className="truncate">{r.name}</span>
              </button>
              <button
                onClick={() => onDeleteResource(r.id, r.name)}
                title={`Remove ${r.name}`}
                className="shrink-0 mr-1 p-1 rounded text-[#c9c2b2] opacity-0 group-hover:opacity-100 hover:text-[#C23B3B] transition-opacity"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto px-5 py-4 border-t border-[var(--c-line)]">
        <label className="text-[10px] font-medium uppercase tracking-wide text-[#8a8578] mb-1.5 flex items-center gap-1.5">
          Commenting as
        </label>
        <div className="flex items-center gap-2">
          <Avatar resource={resources.find((r) => r.name === currentUser)} size={22} />
          <select
            value={currentUser}
            onChange={(e) => setCurrentUser(e.target.value)}
            className="flex-1 min-w-0 text-sm rounded-lg border border-[var(--c-line)] px-2 py-1.5 bg-white outline-none focus:border-[var(--c-green)]"
          >
            <option value="">Not set</option>
            {resources.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-[10px] text-[#a39d8c]">Entegro</p>
          <button
            onClick={onSignOut}
            className="flex items-center gap-1 text-[10px] text-[#8a8578] hover:text-[#C23B3B]"
          >
            <LogOut size={11} />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
