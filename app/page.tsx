"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import Sidebar, { ViewMode } from "@/components/Sidebar";
import KanbanBoard from "@/components/KanbanBoard";
import TimelineView from "@/components/TimelineView";
import CalendarView from "@/components/CalendarView";
import TaskModal from "@/components/TaskModal";
import ProjectModal from "@/components/ProjectModal";
import { useTaskData } from "@/lib/useTaskData";
import { Status, Task } from "@/lib/types";

export default function Home() {
  const {
    tasks,
    resources,
    projects,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    createProject,
  } = useTaskData();

  const [view, setView] = useState<ViewMode>("board");
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [activeResource, setActiveResource] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalTask, setModalTask] = useState<Task | null | "new">(null);
  const [showProjectModal, setShowProjectModal] = useState(false);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (activeProject && t.project_id !== activeProject) {
        // still include its subtasks' parent match; simplest: filter top-level + subtasks whose parent matches
        const parent = tasks.find((p) => p.id === t.parent_task_id);
        if (!parent || parent.project_id !== activeProject) return false;
      }
      if (activeResource) {
        const isAssignedOrChildAssigned =
          t.assigned_to === activeResource ||
          tasks.some((s) => s.parent_task_id === t.id && s.assigned_to === activeResource);
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
  };

  async function handleMoveStatus(taskId: string, status: Status) {
    await updateTask(taskId, { status });
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
      />

      <main className="flex-1 p-7 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h1 className="font-display font-semibold text-2xl">{viewTitles[view]}</h1>
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
              <CalendarView tasks={filteredTasks} onOpenTask={(t) => setModalTask(t)} />
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
          onClose={() => setModalTask(null)}
          onCreate={createTask}
          onUpdate={updateTask}
          onDelete={deleteTask}
        />
      )}

      {showProjectModal && (
        <ProjectModal onClose={() => setShowProjectModal(false)} onCreate={createProject} />
      )}
    </div>
  );
}
