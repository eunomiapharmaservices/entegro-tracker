"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export function useViewOnlyEmails() {
  const [viewOnlyEmails, setViewOnlyEmails] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.rpc("view_only_emails").then(({ data, error }) => {
      if (!active) return;
      if (!error && data) {
        setViewOnlyEmails(new Set((data as string[]).map((e) => e.toLowerCase())));
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { viewOnlyEmails, loading };
}
