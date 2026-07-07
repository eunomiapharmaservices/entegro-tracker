"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { Project, Resource, Task } from "./types";

export function useTaskData() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [tasksRes, resourcesRes, projectsRes] = await Promise.all([
      supabase.from("tasks").select("*").order("position", { ascending: true }),
      supabase.from("resources").select("*").order("created_at", { ascending: true }),
      supabase.from("projects").select("*").order("created_at", { ascending: true }),
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

  const createResource = useCallback(async (name: string, color: string) => {
    const { data, error } = await supabase
      .from("resources")
      .insert({ name, color })
      .select()
      .single();
    if (error) throw error;
    setResources((prev) => [...prev, data as Resource]);
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

  return {
    tasks,
    resources,
    projects,
    loading,
    error,
    reload,
    createTask,
    updateTask,
    deleteTask,
    createResource,
    createProject,
  };
}
