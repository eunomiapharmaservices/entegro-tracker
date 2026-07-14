"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { Search, Upload, Download } from "lucide-react";
import Sidebar, { ViewMode, UNASSIGNED_FILTER } from "@/components/Sidebar";
import KanbanBoard from "@/components/KanbanBoard";
import TimelineView from "@/components/TimelineView";
import CalendarView from "@/components/CalendarView";
import PeopleDashboard from "@/components/PeopleDashboard";
import TaskListView from "@/components/TaskListView";
import CommentLogView from "@/components/CommentLogView";
import TaskModal from "@/components/TaskModal";
import ImportModal from "@/components/ImportModal";
import ProjectModal from "@/components/ProjectModal";
import ResourceModal from "@/components/ResourceModal";
import ManageUsersModal from "@/components/ManageUsersModal";
import AuthGate from "@/components/AuthGate";
import { useTaskData } from "@/lib/useTaskData";
import { useUserRole } from "@/lib/useUserRole";
import { supabase } from "@/lib/supabaseClient";
import { Status, Task, STATUS_LABELS, Resource, Project } from "@/lib/types";
import { downloadCSV } from "@/lib/csvImport";

export default function Home() {
  return (
    <AuthGate>
      <HomeContent />
    </AuthGate>
  );
}

function HomeContent() {
  const {
    tasks,
    allTasks,
    resources,
    projects,
    taskComments,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    createProject,
    updateProject,
    createResource,
    updateResource,
    deleteResource,
    addComment,
  } = useTaskData();
  const { userId, email, isAdminOrAbove, isSuper, canEdit } = useUserRole();

  // The commenting identity is now just "whoever's logged in" — matched to
  // their People entry by email if one exists (for a friendly display name),
  // falling back to their login email.
  const currentUserName = useMemo(() => {
    if (!email) return "";
    const match = resources.find((r) => r.email && r.email.toLowerCase() === email.toLowerCase());
    return match?.name || email;
  }, [resources, email]);

  const [view, setView] = useState<ViewMode>("board");
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [activeResource, setActiveResource] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalTask, setModalTask] = useState<Task | null | "new">(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [showManageUsersModal, setShowManageUsersModal] = useState(false);

  const filteredTasks = useMemo(() => {
    function isAssignedTo(t: Task, resourceId: string): boolean {
      return t.assignee_ids?.length ? t.assignee_ids.includes(resourceId) : t.assigned_to === resourceId;
    }
    function isUnassigned(t: Task): boolean {
      return !t.assigned_to && !t.assignee_ids?.length;
    }
    return tasks.filter((t) => {
      if (activeProject && t.project_id !== activeProject) {
        // still include its subtasks' parent match; simplest: filter top-level + subtasks whose parent matches
        const parent = tasks.find((p) => p.id === t.parent_task_id);
        if (!parent || parent.project_id !== activeProject) return false;
      }
      if (activeResource === UNASSIGNED_FILTER) {
        const isUnassignedOrChildUnassigned =
          isUnassigned(t) || tasks.some((s) => s.parent_task_id === t.id && isUnassigned(s));
        if (!isUnassignedOrChildUnassigned) return false;
      } else if (activeResource) {
        const isAssignedOrChildAssigned =
          isAssignedTo(t, activeResource) ||
          tasks.some((s) => s.parent_task_id === t.id && isAssignedTo(s, activeResource));
        if (!isAssignedOrChildAssigned) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches = t.title.toLowerCase().includes(q);
        const childMatches = tasks.some(
          (s) => s.parent_task_id === t.id && s.title.toLowerCase().includes(q)
        );
        if (!matches && !childMatches) return false;
      }
      return true;
    });
  }, [tasks, activeProject, activeResource, search]);

  const viewTitles: Record<ViewMode, string> = {
    board: "Board",
    timeline: "Timeline",
    calendar: "Calendar",
    people: "People",
    list: "List",
    log: "Comment log",
  };

  async function handleMoveStatus(taskId: string, status: Status) {
    const previous = tasks.find((t) => t.id === taskId);
    await updateTask(taskId, { status });
    if (previous && previous.status !== status) {
      await addComment(
        taskId,
        `Status changed from "${STATUS_LABELS[previous.status]}" to "${STATUS_LABELS[status]}"`,
        currentUserName || null
      );
    }
  }

  // Used anywhere a task is deleted outside the task editor (e.g. bulk
  // delete in List view) — the editor's own delete button logs this itself.
  async function handleDeleteTaskWithLog(id: string) {
    await addComment(id, "Task deleted", currentUserName || null);
    await deleteTask(id);
  }

  function handleArchiveProject(id: string, _name: string) {
    updateProject(id, { archived: true });
  }

  function handleUnarchiveProject(id: string, _name: string) {
    updateProject(id, { archived: false });
  }

  function handleDeleteResource(id: string, name: string) {
    if (!confirm(`Remove ${name}? Their tasks will just become unassigned, not deleted.`)) return;
    deleteResource(id);
    if (activeResource === id) setActiveResource(null);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  function handleExportProjects() {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = ["name,color", ...projects.map((p) => `${esc(p.name)},${p.color}`)];
    downloadCSV("projects-export.csv", rows.join("\n"));
  }

  function handleExportResources() {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = [
      "name,email,color",
      ...resources.map((r) => `${esc(r.name)},${esc(r.email || "")},${r.color}`),
    ];
    downloadCSV("people-export.csv", rows.join("\n"));
  }

  function handleExportAllTasks() {
    const esc = (s: string) => `"${(s || "").replace(/"/g, '""')}"`;
    const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name || "";
    const resourceName = (id: string | null) => resources.find((r) => r.id === id)?.name || "";
    const parentTitle = (id: string | null) => tasks.find((t) => t.id === id)?.title || "";

    const cols = [
      "task_id",
      "title",
      "description",
      "project",
      "assigned_to",
      "status",
      "priority",
      "start_date",
      "due_date",
      "is_milestone",
      "milestone_date",
      "parent_task",
      "task_type",
      "eid",
      "site_name",
      "raised_by",
      "expected_duration_hours",
      "actual_time_spent_hours",
      "date_added",
      "actual_completion",
      "progress_percent",
    ];
    const rows = [
      cols.join(","),
      ...tasks.map((t) =>
        [
          esc(t.task_number || ""),
          esc(t.title),
          esc(t.description || ""),
          esc(projectName(t.project_id)),
          esc(resourceName(t.assigned_to)),
          t.status,
          t.priority,
          t.start_date || "",
          t.due_date || "",
          t.is_milestone ? "true" : "false",
          t.milestone_date || "",
          esc(parentTitle(t.parent_task_id)),
          esc(t.task_type || ""),
          esc(t.eid || ""),
          esc(t.site_name || ""),
          esc(t.raised_by || ""),
          t.expected_duration_hours ?? "",
          t.actual_time_spent_hours ?? "",
          t.date_added || "",
          t.actual_completion || "",
          t.progress_percent,
        ].join(",")
      ),
    ];
    downloadCSV(`tasks-export-${new Date().toISOString().slice(0, 10)}.csv`, rows.join("\n"));
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center flex-col gap-2 px-6 text-center">
        <p className="font-display font-semibold text-lg">Couldn't load data</p>
        <p className="text-sm text-[#8a8578] max-w-md">{error}</p>
        <p className="text-xs text-[#a39d8c] max-w-md mt-2">
          Check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set,
          and that supabase/schema.sql has been run in your Supabase project.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        view={view}
        setView={setView}
        projects={projects}
        resources={resources}
        activeProject={activeProject}
        setActiveProject={setActiveProject}
        activeResource={activeResource}
        setActiveResource={setActiveResource}
        onNewTask={() => setModalTask("new")}
        onNewProject={() => setShowProjectModal(true)}
        onEditProject={(p) => setEditingProject(p)}
        onNewResource={() => setShowResourceModal(true)}
        onArchiveProject={handleArchiveProject}
        onUnarchiveProject={handleUnarchiveProject}
        onDeleteResource={handleDeleteResource}
        onEditResource={(r) => setEditingResource(r)}
        onExportProjects={handleExportProjects}
        onExportResources={handleExportResources}
        currentUserName={currentUserName}
        onSignOut={handleSignOut}
        onManageAccess={() => setShowManageUsersModal(true)}
        isAdminOrAbove={isAdminOrAbove}
        isSuper={isSuper}
        canEdit={canEdit}
      />

      <main className="flex-1 p-7 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h1 className="font-display font-semibold text-2xl">{viewTitles[view]}</h1>
          <div className="flex items-center gap-2">
            {isAdminOrAbove && (
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-[var(--c-line)] bg-white hover:bg-black/5"
              >
                <Upload size={14} />
                Import
              </button>
            )}
            <button
              onClick={handleExportAllTasks}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-[var(--c-line)] bg-white hover:bg-black/5"
            >
              <Download size={14} />
              Export tasks
            </button>
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a39d8c]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                className="pl-8 pr-3 py-2 rounded-lg border border-[var(--c-line)] bg-white text-sm w-56 outline-none focus:border-[var(--c-green)]"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[#a39d8c]">
            Loading…
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            {view === "board" && (
              <KanbanBoard
                tasks={filteredTasks}
                resources={resources}
                projects={projects}
                onOpenTask={(t) => setModalTask(t)}
                onMoveStatus={handleMoveStatus}
                canEdit={canEdit}
              />
            )}
            {view === "timeline" && (
              <TimelineView
                tasks={filteredTasks}
                resources={resources}
                onOpenTask={(t) => setModalTask(t)}
              />
            )}
            {view === "calendar" && (
              <CalendarView
                tasks={filteredTasks}
                resources={resources}
                onOpenTask={(t) => setModalTask(t)}
              />
            )}
            {view === "people" && (
              <PeopleDashboard
                resources={resources}
                projects={projects}
                tasks={tasks}
                onOpenTask={(t) => setModalTask(t)}
              />
            )}
            {view === "list" && (
              <TaskListView
                tasks={filteredTasks}
                resources={resources}
                projects={projects}
                onOpenTask={(t) => setModalTask(t)}
                onDeleteTask={handleDeleteTaskWithLog}
                canDelete={isAdminOrAbove}
              />
            )}
            {view === "log" && isAdminOrAbove && (
              <CommentLogView
                taskComments={taskComments}
                tasks={allTasks}
                onOpenTask={(t) => setModalTask(t)}
              />
            )}
          </div>
        )}
      </main>

      {modalTask !== null && (
        <TaskModal
          task={modalTask === "new" ? null : modalTask}
          defaultProjectId={activeProject}
          tasks={tasks}
          resources={resources}
          projects={projects}
          taskComments={taskComments}
          onClose={() => setModalTask(null)}
          onCreate={createTask}
          onUpdate={updateTask}
          onDelete={deleteTask}
          createProject={createProject}
          addComment={addComment}
          authorName={currentUserName}
          canDelete={isAdminOrAbove}
          canEdit={canEdit}
        />
      )}

      {showImportModal && isAdminOrAbove && (
        <ImportModal
          projects={projects}
          resources={resources}
          tasks={tasks}
          onClose={() => setShowImportModal(false)}
          createProject={createProject}
          createResource={createResource}
          createTask={createTask}
          updateTask={updateTask}
        />
      )}

      {showProjectModal && isAdminOrAbove && (
        <ProjectModal onClose={() => setShowProjectModal(false)} onCreate={createProject} />
      )}

      {editingProject && isAdminOrAbove && (
        <ProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onCreate={createProject}
          onUpdate={updateProject}
        />
      )}

      {showResourceModal && isAdminOrAbove && (
        <ResourceModal onClose={() => setShowResourceModal(false)} onCreate={createResource} />
      )}

      {editingResource && isAdminOrAbove && (
        <ResourceModal
          resource={editingResource}
          onClose={() => setEditingResource(null)}
          onCreate={createResource}
          onUpdate={updateResource}
        />
      )}

      {showManageUsersModal && isAdminOrAbove && (
        <ManageUsersModal
          onClose={() => setShowManageUsersModal(false)}
          currentUserId={userId}
          isSuper={isSuper}
          isAdminOrAbove={isAdminOrAbove}
        />
      )}
    </div>
  );
}
