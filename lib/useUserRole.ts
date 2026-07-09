"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export type Role = "super" | "admin" | "normal";

export function useUserRole() {
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      const userEmail = sessionData.session?.user?.email ?? null;
      if (!uid) {
        if (active) {
          setRole(null);
          setUserId(null);
          setEmail(null);
          setLoading(false);
        }
        return;
      }
      if (active) {
        setUserId(uid);
        setEmail(userEmail);
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single();
      if (active) {
        setRole(error || !data ? "normal" : (data.role as Role));
        setLoading(false);
      }
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const isSuper = role === "super";
  const isAdminOrAbove = role === "super" || role === "admin";

  return { role, userId, email, loading, isSuper, isAdminOrAbove };
}
