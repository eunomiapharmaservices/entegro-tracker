"use client";

import { Plus, Trash2, Download, Archive, ArchiveRestore, ChevronDown, ChevronRight, LogOut, ShieldCheck, Pencil } from "lucide-react";
import { LayoutGrid, Calendar as CalendarIcon, BarChart3, Users, List, ScrollText } from "lucide-react";
import { useState } from "react";
import { Project, Resource } from "@/lib/types";
import { useManageUsers } from "@/lib/useManageUsers";
import type { Role } from "@/lib/useUserRole";
import Avatar from "./Avatar";

const ROLE_LABELS: Record<Role, string> = {
  super: "Super User",
  admin: "Admin",
  normal: "Normal User",
  view: "View Only",
};
const ROLE_ORDER: Role[] = ["super", "admin", "normal", "view"];

export type ViewMode = "board" | "timeline" | "calendar" | "people" | "list" | "log";

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
  onDeleteResource,
  onEditResource,
  onExportProjects,
  onExportResources,
  currentUserName,
  onSignOut,
  onManageAccess,
  isAdminOrAbove,
  isSuper,
  canEdit,
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
  onDeleteResource: (id: string, name: string) => void;
  onEditResource: (resource: Resource) => void;
  onExportProjects: () => void;
  onExportResources: () => void;
  currentUserName: string;
  onSignOut: () => void;
  onManageAccess: () => void;
  isAdminOrAbove: boolean;
  isSuper: boolean;
  canEdit: boolean;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const sortByName = (a: Project, b: Project) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  const activeProjects = projects.filter((p) => !p.archived).sort(sortByName);
  const archivedProjects = projects.filter((p) => p.archived).sort(sortByName);

  // Resources (the task-assignee roster) don't carry a login role themselves
  // — roles live on registered accounts. Match by email to group/drag people
  // by role here too. Only fetched/used for Admin/Super, since RLS means a
  // Normal/View user wouldn't see other people's profiles anyway.
  const { profiles, allowedEmails, updateProfileRole, upsertAllowedEmailRole } = useManageUsers();
  const [dragOverRole, setDragOverRole] = useState<Role | null>(null);

  function roleForResource(r: Resource): Role | null {
    if (!r.email) return null;
    const profile = profiles.find((p) => p.email.toLowerCase() === r.email!.toLowerCase());
    if (profile) return profile.role;
    const invite = allowedEmails.find((e) => e.email.toLowerCase() === r.email!.toLowerCase());
    return invite ? invite.role : null;
  }

  async function handleDropResourceOnRole(resource: Resource, role: Role) {
    if (!resource.email) {
      alert(`${resource.name} doesn't have an email set, so there's no account to assign a role to.`);
      return;
    }
    try {
      const profile = profiles.find((p) => p.email.toLowerCase() === resource.email!.toLowerCase());
      if (profile) {
        await updateProfileRole(profile.id, role);
      } else {
        // No account yet — set the role they'll get once they register.
        await upsertAllowedEmailRole(resource.email, role);
      }
    } catch (err) {
      alert(`Couldn't change ${resource.name}'s role: ${(err as Error).message || "unknown error"}`);
    }
  }

  const navItems: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: "board", label: "Board", icon: <LayoutGrid size={17} /> },
    { key: "timeline", label: "Timeline", icon: <BarChart3 size={17} /> },
    { key: "calendar", label: "Calendar", icon: <CalendarIcon size={17} /> },
    { key: "list", label: "List", icon: <List size={17} /> },
    { key: "people", label: "People", icon: <Users size={17} /> },
    ...(isAdminOrAbove
      ? [{ key: "log" as ViewMode, label: "Log", icon: <ScrollText size={17} /> }]
      : []),
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

      {canEdit && (
        <button
          onClick={onNewTask}
          className="mx-5 mb-5 flex items-center justify-center gap-2 rounded-lg bg-[var(--c-green)] text-white text-sm font-medium py-2.5 hover:bg-[#194a3b] transition-colors"
        >
          <Plus size={16} /> New task
        </button>
      )}

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
            {isAdminOrAbove && (
              <button
                onClick={onNewProject}
                title="Add project"
                className="text-[#8a8578] hover:text-[var(--c-ink)]"
              >
                <Plus size={14} />
              </button>
            )}
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
              {isAdminOrAbove && (
                <button
                  onClick={() => onArchiveProject(p.id, p.name)}
                  title={`Archive ${p.name}`}
                  className="shrink-0 mr-1 p-1 rounded text-[#c9c2b2] opacity-0 group-hover:opacity-100 hover:text-[var(--c-orange)] transition-opacity"
                >
                  <Archive size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {isAdminOrAbove && archivedProjects.length > 0 && (
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
                      className="shrink-0 mr-1 p-1 rounded text-[#c9c2b2] opacity-0 group-hover:opacity-100 hover:text-[var(--c-green)] transition-opacity"
                    >
                      <ArchiveRestore size={13} />
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
            {isAdminOrAbove && (
              <button
                onClick={onNewResource}
                title="Add person"
                className="text-[#8a8578] hover:text-[var(--c-ink)]"
              >
                <Plus size={14} />
              </button>
            )}
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

          {isAdminOrAbove ? (
            <div className="flex flex-col gap-2.5 mt-1">
              {[...ROLE_ORDER, null].map((role) => {
                const group = resources.filter((r) => roleForResource(r) === role);
                const label = role ? ROLE_LABELS[role] : "No login yet";
                return (
                  <div
                    key={role ?? "none"}
                    onDragOver={(e) => {
                      if (!role) return; // can't drop into "No login yet"
                      e.preventDefault();
                      setDragOverRole(role);
                    }}
                    onDragLeave={() => setDragOverRole((cur) => (cur === role ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!role) return;
                      const resourceId = e.dataTransfer.getData("text/resource-id");
                      const resource = resources.find((r) => r.id === resourceId);
                      if (resource) handleDropResourceOnRole(resource, role);
                      setDragOverRole(null);
                    }}
                    className={`rounded-lg p-1 -m-1 transition-colors ${
                      dragOverRole === role ? "bg-[var(--c-green)]/10 ring-2 ring-[var(--c-green)]/30" : ""
                    }`}
                  >
                    <p className="text-[10px] font-medium text-[#a39d8c] uppercase tracking-wide px-1 mb-1">
                      {label} ({group.length})
                    </p>
                    {group.length === 0 && dragOverRole === role && (
                      <div className="text-[11px] text-[var(--c-green)] border border-dashed border-[var(--c-green)]/40 rounded-lg px-2.5 py-2 text-center mb-1">
                        Drop here to make {label}
                      </div>
                    )}
                    <div className="flex flex-col gap-0.5">
                      {group.map((r) => (
                        <div
                          key={r.id}
                          draggable={isSuper && !!role}
                          onDragStart={(e) => e.dataTransfer.setData("text/resource-id", r.id)}
                          className={`group flex items-center gap-1 rounded-md ${
                            activeResource === r.id ? "bg-black/5" : "hover:bg-black/5"
                          } ${isSuper && role ? "cursor-grab active:cursor-grabbing" : ""}`}
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
                            onClick={() => onEditResource(r)}
                            title={`Edit ${r.name}`}
                            className="shrink-0 p-1 rounded text-[#c9c2b2] opacity-0 group-hover:opacity-100 hover:text-[var(--c-green)] transition-opacity"
                          >
                            <Pencil size={12} />
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
                );
              })}
            </div>
          ) : (
            resources.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveResource(r.id)}
                className={`text-left text-sm px-2 py-1.5 rounded-md flex items-center gap-2 ${
                  activeResource === r.id ? "bg-black/5 font-medium" : "hover:bg-black/5 text-[#4d574f]"
                }`}
              >
                <Avatar resource={r} size={20} />
                <span className="truncate">{r.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="mt-auto px-5 py-4 border-t border-[var(--c-line)]">
        <div className="flex items-center gap-2 mb-3">
          <Avatar resource={resources.find((r) => r.name === currentUserName)} size={22} />
          <div className="min-w-0">
            <p className="text-[10px] text-[#a39d8c] uppercase tracking-wide font-display">
              Signed in as
            </p>
            <p className="text-sm truncate">{currentUserName}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          {isAdminOrAbove ? (
            <button
              onClick={onManageAccess}
              className="flex items-center gap-1 text-[10px] text-[#8a8578] hover:text-[var(--c-ink)]"
            >
              <ShieldCheck size={11} />
              Manage users
            </button>
          ) : (
            <span />
          )}
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
