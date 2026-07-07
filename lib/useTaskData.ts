"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { Project, Resource, Task, TaskComment } from "./types";

export function useTaskData() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setTasks(tasksRes.data as Task[]);
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

  const createTask = useCallback(
    async (input: Partial<Task>) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      setTasks((prev) => [...prev, data as Task]);
      return data as Task;
    },
    []
  );

  const updateTask = useCallback(async (id: string, input: Partial<Task>) => {
    const { data, error } = await supabase
      .from("tasks")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setTasks((prev) => prev.map((t) => (t.id === id ? (data as Task) : t)));
    return data as Task;
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
    setTasks((prev) => prev.filter((t) => t.id !== id && t.parent_task_id !== id));
  }, []);

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
    setTasks((prev) =>
      prev.map((t) => (t.assigned_to === id ? { ...t, assigned_to: null } : t))
    );
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    // Tasks in this project are detached rather than deleted (FK is
    // ON DELETE SET NULL), so mirror that in local state too.
    setTasks((prev) =>
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
    createProject,
    updateProject,
    deleteResource,
    deleteProject,
    addComment,
    deleteComment,
  };
}
