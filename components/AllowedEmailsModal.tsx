"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useAllowedEmails } from "@/lib/useAllowedEmails";

export default function AllowedEmailsModal({ onClose }: { onClose: () => void }) {
  const { allowedEmails, loading, addAllowedEmail, removeAllowedEmail } = useAllowedEmails();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!email.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addAllowedEmail(email, note);
      setEmail("");
      setNote("");
    } catch (err) {
      setError((err as Error).message || "Couldn't add that email.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--c-cream)] rounded-2xl w-full max-w-sm shadow-2xl border border-[var(--c-line)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-semibold text-base">Manage access</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-[#8a8578] mb-4">
          Only these email addresses can register a new account.
        </p>

        <div className="flex flex-col gap-1.5 mb-3 max-h-56 overflow-y-auto">
          {loading && <p className="text-xs text-[#c9c2b2]">Loading…</p>}
          {!loading && allowedEmails.length === 0 && (
            <p className="text-xs text-[#c9c2b2]">
              No allowed emails yet — add one below, or no one new can register.
            </p>
          )}
          {allowedEmails.map((e) => (
            <div
              key={e.email}
              className="flex items-center gap-2 bg-white border border-[var(--c-line)] rounded-lg px-2.5 py-1.5"
            >
              <span className="text-sm flex-1 truncate">{e.email}</span>
              {e.note && <span className="text-xs text-[#a39d8c] truncate">{e.note}</span>}
              <button
                onClick={() => removeAllowedEmail(e.email)}
                className="text-[#c9c2b2] hover:text-[#C23B3B] shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-[#C23B3B] mb-2">{error}</p>}

        <div className="flex flex-col gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@lumen.com"
            className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm bg-white outline-none focus:border-[var(--c-green)]"
          />
          <div className="flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              className="flex-1 min-w-0 rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm bg-white outline-none focus:border-[var(--c-green)]"
            />
            <button
              onClick={handleAdd}
              disabled={saving || !email.trim()}
              className="shrink-0 rounded-lg bg-[var(--c-green)] text-white px-3 hover:bg-[#194a3b] disabled:opacity-50"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
