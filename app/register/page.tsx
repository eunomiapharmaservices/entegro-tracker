"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail, checkPassword } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordCheck = checkPassword(password);
  const emailValid = email.trim() === "" || isAllowedEmail(email);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!isAllowedEmail(email)) {
      setError(`Registration is limited to @${ALLOWED_EMAIL_DOMAIN} email addresses.`);
      return;
    }
    if (!passwordCheck.valid) {
      setError(`Password needs: ${passwordCheck.issues.join(", ")}.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);

    const { data: allowed, error: rpcError } = await supabase.rpc("is_email_allowed", {
      check_email: email.trim(),
    });
    if (rpcError) {
      setSubmitting(false);
      setError("Couldn't verify access right now — try again in a moment.");
      return;
    }
    if (!allowed) {
      setSubmitting(false);
      setError("This email hasn't been approved for registration. Ask an admin to add it first.");
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      // Email confirmation is disabled on this Supabase project — signed in immediately.
      router.push("/");
    } else {
      setInfo("Account created — check your inbox for a confirmation link before signing in.");
    }
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
          <h1 className="font-display font-semibold text-lg mb-1">Create an account</h1>
          <p className="text-sm text-[#8a8578] mb-5">
            Registration is limited to approved @{ALLOWED_EMAIL_DOMAIN} addresses.
            Ask an admin to add yours first if you haven't been invited.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-[#8a8578] mb-1 block font-display">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-white outline-none focus:border-[var(--c-green)] ${
                  emailValid ? "border-[var(--c-line)]" : "border-[#C23B3B]"
                }`}
              />
              {!emailValid && (
                <p className="text-[11px] text-[#C23B3B] mt-1">
                  Must be an @{ALLOWED_EMAIL_DOMAIN} address.
                </p>
              )}
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
              {password && !passwordCheck.valid && (
                <p className="text-[11px] text-[#C23B3B] mt-1">
                  Needs: {passwordCheck.issues.join(", ")}.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-[#8a8578] mb-1 block font-display">
                Confirm password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm bg-white outline-none focus:border-[var(--c-green)]"
              />
            </div>

            {error && <p className="text-sm text-[#C23B3B]">{error}</p>}
            {info && <p className="text-sm text-[var(--c-green)]">{info}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[var(--c-green)] text-white text-sm font-medium py-2.5 hover:bg-[#194a3b] disabled:opacity-50"
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#8a8578] mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--c-green)] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
