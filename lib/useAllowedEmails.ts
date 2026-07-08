"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export interface AllowedEmail {
  email: string;
  note: string | null;
  created_at: string;
}

export function useAllowedEmails() {
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("allowed_emails")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error) setAllowedEmails(data as AllowedEmail[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addAllowedEmail = useCallback(async (email: string, note?: string | null) => {
    const { data, error } = await supabase
      .from("allowed_emails")
      .insert({ email: email.trim().toLowerCase(), note: note || null })
      .select()
      .single();
    if (error) throw error;
    setAllowedEmails((prev) => [...prev, data as AllowedEmail]);
    return data as AllowedEmail;
  }, []);

  const removeAllowedEmail = useCallback(async (email: string) => {
    const { error } = await supabase.from("allowed_emails").delete().eq("email", email);
    if (error) throw error;
    setAllowedEmails((prev) => prev.filter((e) => e.email !== email));
  }, []);

  return { allowedEmails, loading, reload, addAllowedEmail, removeAllowedEmail };
}
