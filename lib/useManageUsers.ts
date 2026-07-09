"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { Role } from "./useUserRole";

export interface AllowedEmail {
  email: string;
  note: string | null;
  role: Role;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  role: Role;
  created_at: string;
}

export function useManageUsers() {
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [allowedRes, profilesRes] = await Promise.all([
      supabase.from("allowed_emails").select("*").order("created_at", { ascending: true }),
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    ]);
    if (allowedRes.error || profilesRes.error) {
      setError(allowedRes.error?.message || profilesRes.error?.message || "Couldn't load users.");
    } else {
      setAllowedEmails(allowedRes.data as AllowedEmail[]);
      setProfiles(profilesRes.data as Profile[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addAllowedEmail = useCallback(
    async (email: string, role: Role, note?: string | null) => {
      const { data, error } = await supabase
        .from("allowed_emails")
        .insert({ email: email.trim().toLowerCase(), role, note: note || null })
        .select()
        .single();
      if (error) throw error;
      setAllowedEmails((prev) => [...prev, data as AllowedEmail]);
      return data as AllowedEmail;
    },
    []
  );

  const removeAllowedEmail = useCallback(async (email: string) => {
    const { error } = await supabase.from("allowed_emails").delete().eq("email", email);
    if (error) throw error;
    setAllowedEmails((prev) => prev.filter((e) => e.email !== email));
  }, []);

  // Sets the role an email will get when they eventually register, whether
  // or not they're already on the allowlist (used when dragging someone
  // without an account yet into a role category).
  const upsertAllowedEmailRole = useCallback(async (email: string, role: Role) => {
    const normalized = email.trim().toLowerCase();
    const { data, error } = await supabase
      .from("allowed_emails")
      .upsert({ email: normalized, role }, { onConflict: "email" })
      .select()
      .single();
    if (error) throw error;
    setAllowedEmails((prev) => {
      const exists = prev.some((e) => e.email === normalized);
      return exists
        ? prev.map((e) => (e.email === normalized ? (data as AllowedEmail) : e))
        : [...prev, data as AllowedEmail];
    });
    return data as AllowedEmail;
  }, []);

  const updateProfileRole = useCallback(async (id: string, role: Role) => {
    const { data, error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setProfiles((prev) => prev.map((p) => (p.id === id ? (data as Profile) : p)));
    return data as Profile;
  }, []);

  const deleteAccount = useCallback(async (id: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Not signed in.");
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: id, callerAccessToken: accessToken }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Couldn't delete that account.");
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return {
    allowedEmails,
    profiles,
    loading,
    error,
    reload,
    addAllowedEmail,
    removeAllowedEmail,
    upsertAllowedEmailRole,
    updateProfileRole,
    deleteAccount,
  };
}
