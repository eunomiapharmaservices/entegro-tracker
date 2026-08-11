"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { ProjectChangeLog } from "./types";

export function useProjectChangeLog() {
  const [entries, setEntries] = useState<ProjectChangeLog[]>([]);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from("project_change_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20000);
    if (!error && data) setEntries(data as ProjectChangeLog[]);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addEntry = useCallback(
    async (projectId: string, body: string, author?: string | null) => {
      const { data, error } = await supabase
        .from("project_change_log")
        .insert({ project_id: projectId, body, author: author || null })
        .select()
        .single();
      if (error) {
        // Never let an audit-trail failure pass silently.
        console.error("Failed to write project change log:", error);
        if (typeof window !== "undefined") {
          window.alert(
            `Couldn't write to the project log: ${error.message}\n\n` +
              "The change itself was saved. If this keeps happening, check that " +
              "migration_038 has been run in Supabase."
          );
        }
        return null;
      }
      setEntries((prev) => [data as ProjectChangeLog, ...prev]);
      return data as ProjectChangeLog;
    },
    []
  );

  return { entries, addEntry, reload };
}
