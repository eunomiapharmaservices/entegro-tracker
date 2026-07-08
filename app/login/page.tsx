"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--c-cream)] px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-7 h-7 rounded-md bg-[var(--c-green)] flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-sm bg-[var(--c-orange)]" />
          </div>
          <span className="font-display font-semibold text-[15px] tracking-tight">
            Entegro Tracker
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--c-line)] p-6">
          <h1 className="font-display font-semibold text-lg mb-5">Sign in</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-[#8a8578] mb-1 block font-display">
                Email
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm bg-white outline-none focus:border-[var(--c-green)]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#8a8578] mb-1 block font-display">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm bg-white outline-none focus:border-[var(--c-green)]"
              />
            </div>

            {error && <p className="text-sm text-[#C23B3B]">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[var(--c-green)] text-white text-sm font-medium py-2.5 hover:bg-[#194a3b] disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#8a8578] mt-5">
          Need an account?{" "}
          <Link href="/register" className="text-[var(--c-green)] font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
