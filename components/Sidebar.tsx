"use client";

import { Plus, Trash2 } from "lucide-react";
import { LayoutGrid, Calendar as CalendarIcon, BarChart3 } from "lucide-react";
import { Project, Resource } from "@/lib/types";
import Avatar from "./Avatar";

export type ViewMode = "board" | "timeline" | "calendar";

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
  onDeleteProject,
  onDeleteResource,
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
  onDeleteProject: (id: string, name: string) => void;
  onDeleteResource: (id: string, name: string) => void;
}) {
  const navItems: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: "board", label: "Board", icon: <LayoutGrid size={17} /> },
    { key: "timeline", label: "Timeline", icon: <BarChart3 size={17} /> },
    { key: "calendar", label: "Calendar", icon: <CalendarIcon size={17} /> },
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
          <button
            onClick={onNewProject}
            title="Add project"
            className="text-[#8a8578] hover:text-[var(--c-ink)]"
          >
            <Plus size={14} />
          </button>
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
          {projects.map((p) => (
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
                onClick={() => onDeleteProject(p.id, p.name)}
                title={`Delete ${p.name}`}
                className="shrink-0 mr-1 p-1 rounded text-[#c9c2b2] opacity-0 group-hover:opacity-100 hover:text-[#C23B3B] transition-opacity"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 mt-7">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[#8a8578]">
            People
          </span>
          <button
            onClick={onNewResource}
            title="Add person"
            className="text-[#8a8578] hover:text-[var(--c-ink)]"
          >
            <Plus size={14} />
          </button>
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

      <div className="mt-auto px-5 py-5 text-xs text-[#a39d8c]">
        Entegro
      </div>
    </aside>
  );
}
