"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export function useViewOnlyEmails() {
  const [viewOnlyEmails, setViewOnlyEmails] = useState<Set<string>>(new Set());
  const [viewOnlyNameGuesses, setViewOnlyNameGuesses] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.rpc("view_only_people").then(({ data, error }) => {
      if (!active) return;
      if (!error && data) {
        const rows = data as { email: string; name_guess: string }[];
        setViewOnlyEmails(new Set(rows.map((r) => r.email.toLowerCase())));
        setViewOnlyNameGuesses(
          new Set(rows.map((r) => r.name_guess.toLowerCase()).filter(Boolean))
        );
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // A resource counts as View Only if its email matches directly, or — for
  // People entries that were never linked to an email — its name matches the
  // guessed first name from a View Only account's email. The name fallback
  // is a best-effort (it can't distinguish two different "Gokul"s), but it's
  // far better than silently showing someone who should be hidden.
  function isViewOnlyResource(resource: { name: string; email?: string | null }): boolean {
    if (resource.email) return viewOnlyEmails.has(resource.email.toLowerCase());
    return viewOnlyNameGuesses.has(resource.name.trim().toLowerCase());
  }

  return { viewOnlyEmails, viewOnlyNameGuesses, isViewOnlyResource, loading };
}
