"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { Project, Resource, Task, TaskComment } from "./types";
import { notifyAssignment } from "./notifyAssignment";

export function useTaskData() {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `tasks` is what every normal view should use (Board, Timeline, Calendar,
  // List, People) — soft-deleted tasks stay in the database forever (so
  // their comment log/history is never lost) but are hidden everywhere
  // except the Comment Log, which uses `allTasks` to still resolve titles.
  const tasks = allTasks.filter((t) => !t.deleted_at);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [tasksRes, resourcesRes, projectsRes, commentsRes] = await Promise.all([
      supabase.from("tasks").select("*").order("position", { ascending: true }),
      supabase.from("resources").select("*").order("created_at", { ascending: true }),
      supabase.from("projects").select("*").order("created_at", { ascending: true }),
      supabase.from("task_comments").select("*").order("created_at", { ascending: true }),
    ]);

    if (tasksRes.error || resourcesRes.error || projectsRes.error) {
      setError(
        tasksRes.error?.message ||
          resourcesRes.error?.message ||
          projectsRes.error?.message ||
          "Something went wrong loading data."
      );
    } else {
      setAllTasks(tasksRes.data as Task[]);
      setResources(resourcesRes.data as Resource[]);
      setProjects(projectsRes.data as Project[]);
      // Comment log table may not exist yet if the migration hasn't been run —
      // don't fail the whole load over it, just show no comment history.
      setTaskComments(commentsRes.error ? [] : (commentsRes.data as TaskComment[]));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Poll for changes made by other people every 60 seconds. Local edits
  // still feel instant since they update state directly (see below); this
  // just catches up on anything someone else changed in the meantime.
  useEffect(() => {
    const interval = setInterval(() => {
      reload();
    }, 60_000);
    return () => clearInterval(interval);
  }, [reload]);

  const createTask = useCallback(
    async (input: Partial<Task>) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      const created = data as Task;
      setAllTasks((prev) => [...prev, created]);

      if (created.assigned_to) {
        const resource = resources.find((r) => r.id === created.assigned_to);
        if (resource?.email) {
          const project = projects.find((p) => p.id === created.project_id);
          notifyAssignment(resource.email, created, project?.name);
        }
      }
      return created;
    },
    [resources, projects]
  );

  const updateTask = useCallback(
    async (id: string, input: Partial<Task>) => {
      const previous = allTasks.find((t) => t.id === id);
      const { data, error } = await supabase
        .from("tasks")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const updated = data as Task;
      setAllTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));

      // Only notify when the assignee actually changed (newly assigned or
      // reassigned) — not on every unrelated edit to an already-assigned task.
      if (updated.assigned_to && updated.assigned_to !== previous?.assigned_to) {
        const resource = resources.find((r) => r.id === updated.assigned_to);
        if (resource?.email) {
          const project = projects.find((p) => p.id === updated.project_id);
          notifyAssignment(resource.email, updated, project?.name);
        }
      }
      return updated;
    },
    [allTasks, resources, projects]
  );

  // Soft delete: mark deleted_at instead of removing the row, so the task's
  // comment log (including the "Task deleted" entry logged by the caller)
  // is preserved forever and still visible in the Comment Log. Subtasks are
  // soft-deleted along with their parent, same idea as the old cascade.
  const deleteTask = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    const childIds = allTasks.filter((t) => t.parent_task_id === id).map((t) => t.id);
    const idsToDelete = [id, ...childIds];
    const { error } = await supabase
      .from("tasks")
      .update({ deleted_at: now })
      .in("id", idsToDelete);
    if (error) throw error;
    setAllTasks((prev) =>
      prev.map((t) => (idsToDelete.includes(t.id) ? { ...t, deleted_at: now } : t))
    );
  }, [allTasks]);

  const createResource = useCallback(
    async (name: string, color: string, email?: string | null) => {
      const { data, error } = await supabase
        .from("resources")
        .insert({ name, color, email: email || null })
        .select()
        .single();
      if (error) throw error;
      setResources((prev) => [...prev, data as Resource]);
      return data as Resource;
    },
    []
  );

  const updateResource = useCallback(async (id: string, input: Partial<Resource>) => {
    const { data, error } = await supabase
      .from("resources")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setResources((prev) => prev.map((r) => (r.id === id ? (data as Resource) : r)));
    return data as Resource;
  }, []);

  const createProject = useCallback(async (name: string, color: string) => {
    const { data, error } = await supabase
      .from("projects")
      .insert({ name, color })
      .select()
      .single();
    if (error) throw error;
    setProjects((prev) => [...prev, data as Project]);
    return data as Project;
  }, []);

  const updateProject = useCallback(async (id: string, input: Partial<Project>) => {
    const { data, error } = await supabase
      .from("projects")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setProjects((prev) => prev.map((p) => (p.id === id ? (data as Project) : p)));
    return data as Project;
  }, []);

  const deleteResource = useCallback(async (id: string) => {
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (error) throw error;
    setResources((prev) => prev.filter((r) => r.id !== id));
    // Tasks assigned to this resource are unassigned server-side (FK is
    // ON DELETE SET NULL), so mirror that in local state too.
    setAllTasks((prev) =>
      prev.map((t) => (t.assigned_to === id ? { ...t, assigned_to: null } : t))
    );
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    // Tasks in this project are detached rather than deleted (FK is
    // ON DELETE SET NULL), so mirror that in local state too.
    setAllTasks((prev) =>
      prev.map((t) => (t.project_id === id ? { ...t, project_id: null } : t))
    );
  }, []);

  const addComment = useCallback(
    async (taskId: string, body: string, author?: string | null) => {
      const { data, error } = await supabase
        .from("task_comments")
        .insert({ task_id: taskId, body, author: author || null })
        .select()
        .single();
      if (error) throw error;
      setTaskComments((prev) => [...prev, data as TaskComment]);
      return data as TaskComment;
    },
    []
  );

  const deleteComment = useCallback(async (id: string) => {
    const { error } = await supabase.from("task_comments").delete().eq("id", id);
    if (error) throw error;
    setTaskComments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return {
    tasks,
    allTasks,
    resources,
    projects,
    taskComments,
    loading,
    error,
    reload,
    createTask,
    updateTask,
    deleteTask,
    createResource,
    updateResource,
    createProject,
    updateProject,
    deleteResource,
    deleteProject,
    addComment,
    deleteComment,
  };
}
