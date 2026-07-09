"use client";

import { useState } from "react";
import { Plus, Trash2, X, ShieldCheck } from "lucide-react";
import { useManageUsers } from "@/lib/useManageUsers";
import type { Role } from "@/lib/useUserRole";

const ROLE_LABELS: Record<Role, string> = {
  super: "Super User",
  admin: "Admin",
  normal: "Normal User",
  view: "View Only",
};

const ROLE_ORDER: Role[] = ["super", "admin", "normal", "view"];

export default function ManageUsersModal({
  onClose,
  currentUserId,
}: {
  onClose: () => void;
  currentUserId: string | null;
}) {
  const {
    allowedEmails,
    profiles,
    loading,
    error,
    addAllowedEmail,
    removeAllowedEmail,
    updateProfileRole,
    deleteAccount,
  } = useManageUsers();

  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [role, setRole] = useState<Role>("normal");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [dragOverRole, setDragOverRole] = useState<Role | null>(null);

  const registeredEmails = new Set(profiles.map((p) => p.email.toLowerCase()));
  const pendingInvites = allowedEmails.filter(
    (e) => !registeredEmails.has(e.email.toLowerCase())
  );

  async function handleAdd() {
    if (!email.trim()) return;
    setSaving(true);
    setAddError(null);
    try {
      await addAllowedEmail(email, role, note);
      setEmail("");
      setNote("");
      setRole("normal");
    } catch (err) {
      setAddError((err as Error).message || "Couldn't add that email.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount(id: string, emailAddr: string) {
    if (!confirm(`Delete the account for ${emailAddr}? This can't be undone.`)) return;
    try {
      await deleteAccount(id);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const selectCls =
    "text-xs rounded-md border border-[var(--c-line)] px-1.5 py-1 bg-white outline-none focus:border-[var(--c-green)]";

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 overflow-y-auto py-10"
      onClick={onClose}
    >
      <div
        className="bg-[var(--c-cream)] rounded-2xl w-full max-w-lg shadow-2xl border border-[var(--c-line)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-semibold text-base flex items-center gap-2">
            <ShieldCheck size={17} className="text-[var(--c-green)]" />
            Manage users
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-[#8a8578] mb-4">
          Only approved emails can register, and each gets a role that
          controls what they can do once signed in. Drag someone between
          categories to change their role, or use the dropdown on their row.
        </p>

        {error && <p className="text-sm text-[#C23B3B] mb-3">{error}</p>}
        {loading && <p className="text-xs text-[#c9c2b2] mb-3">Loading…</p>}

        {profiles.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[#8a8578] mb-1.5 font-display">
              Registered ({profiles.length})
            </p>
            <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
              {ROLE_ORDER.map((r) => {
                const group = profiles.filter((p) => p.role === r);
                return (
                  <div
                    key={r}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverRole(r);
                    }}
                    onDragLeave={() => setDragOverRole((cur) => (cur === r ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/profile-id");
                      if (id) updateProfileRole(id, r);
                      setDragOverRole(null);
                    }}
                    className={`rounded-lg p-1.5 -m-1.5 transition-colors ${
                      dragOverRole === r ? "bg-[var(--c-green)]/10 ring-2 ring-[var(--c-green)]/30" : ""
                    }`}
                  >
                    <p className="text-[10px] font-medium text-[#a39d8c] uppercase tracking-wide mb-1">
                      {ROLE_LABELS[r]} ({group.length})
                    </p>
                    <div className="flex flex-col gap-1.5 min-h-[6px]">
                      {group.length === 0 && dragOverRole === r && (
                        <div className="text-[11px] text-[var(--c-green)] border border-dashed border-[var(--c-green)]/40 rounded-lg px-2.5 py-2 text-center">
                          Drop here to make {ROLE_LABELS[r]}
                        </div>
                      )}
                      {group.map((p) => (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/profile-id", p.id);
                          }}
                          className="flex items-center gap-2 bg-white border border-[var(--c-line)] rounded-lg px-2.5 py-1.5 cursor-grab active:cursor-grabbing"
                        >
                          <span className="text-sm flex-1 truncate">{p.email}</span>
                          <select
                            value={p.role}
                            onChange={(e) => updateProfileRole(p.id, e.target.value as Role)}
                            className={selectCls}
                          >
                            {ROLE_ORDER.map((rr) => (
                              <option key={rr} value={rr}>
                                {ROLE_LABELS[rr]}
                              </option>
                            ))}
                          </select>
                          {p.id !== currentUserId && (
                            <button
                              onClick={() => handleDeleteAccount(p.id, p.email)}
                              className="text-[#c9c2b2] hover:text-[#C23B3B] shrink-0"
                              title="Delete account"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#8a8578] mb-1.5 font-display">
            Invited, not yet registered ({pendingInvites.length})
          </p>
          <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
            {pendingInvites.length === 0 && (
              <p className="text-xs text-[#c9c2b2]">Nothing pending.</p>
            )}
            {pendingInvites.map((e) => (
              <div
                key={e.email}
                className="flex items-center gap-2 bg-white border border-dashed border-[var(--c-line)] rounded-lg px-2.5 py-1.5"
              >
                <span className="text-sm flex-1 truncate text-[#4d574f]">{e.email}</span>
                <span className="text-[10px] text-[#a39d8c]">{ROLE_LABELS[e.role]}</span>
                {e.note && <span className="text-xs text-[#a39d8c] truncate">{e.note}</span>}
                <button
                  onClick={() => removeAllowedEmail(e.email)}
                  className="text-[#c9c2b2] hover:text-[#C23B3B] shrink-0"
                  title="Withdraw invite"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {addError && <p className="text-xs text-[#C23B3B] mb-2">{addError}</p>}

        <div className="border-t border-[var(--c-line)] pt-3 flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[#8a8578] font-display">
            Invite someone new
          </p>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@lumen.com"
            className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm bg-white outline-none focus:border-[var(--c-green)]"
          />
          <div className="flex gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="rounded-lg border border-[var(--c-line)] px-2 py-2 text-sm bg-white outline-none focus:border-[var(--c-green)]"
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
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
