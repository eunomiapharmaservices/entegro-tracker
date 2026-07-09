"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Resource } from "@/lib/types";
import { deriveNameFromEmail } from "@/lib/nameFromEmail";

const COLOR_OPTIONS = ["#1F5C4A", "#E07A3E", "#3B6E8F", "#8A5FB0", "#C23B3B", "#7A8B84"];

export default function ResourceModal({
  resource,
  onClose,
  onCreate,
  onUpdate,
}: {
  resource?: Resource | null; // pass to edit an existing person; omit to add a new one
  onClose: () => void;
  onCreate: (name: string, color: string, email?: string | null) => Promise<unknown>;
  onUpdate?: (id: string, input: Partial<Resource>) => Promise<unknown>;
}) {
  const isEdit = !!resource;
  const [email, setEmail] = useState(resource?.email ?? "");
  const [name, setName] = useState(resource?.name ?? "");
  const [nameTouched, setNameTouched] = useState(isEdit); // don't auto-overwrite an existing name
  const [color, setColor] = useState(resource?.color ?? COLOR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);

  function handleEmailChange(value: string) {
    setEmail(value);
    // Suggest a name from the email's local part — only while the person
    // hasn't typed their own name yet, so we never clobber a real edit.
    if (!nameTouched) {
      const suggestion = deriveNameFromEmail(value);
      if (suggestion) setName(suggestion);
    }
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isEdit && resource && onUpdate) {
        await onUpdate(resource.id, {
          name: name.trim(),
          color,
          email: email.trim() || null,
        });
      } else {
        await onCreate(name.trim(), color, email.trim() || null);
      }
      onClose();
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-base">
            {isEdit ? "Edit person" : "New person"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5">
            <X size={18} />
          </button>
        </div>

        <label className="text-xs font-medium text-[#8a8578] mb-1 block font-display">
          Email
        </label>
        <input
          autoFocus
          type="email"
          className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm bg-white outline-none focus:border-[var(--c-green)] mb-3"
          placeholder="name@lumen.com"
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
        />
        <p className="text-[11px] text-[#a39d8c] -mt-2 mb-3">
          Linking an email lets this person's role (and board access) connect
          to their login account, and lets them receive assignment emails.
        </p>

        <label className="text-xs font-medium text-[#8a8578] mb-1 block font-display">
          Name
        </label>
        <input
          className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm bg-white outline-none focus:border-[var(--c-green)] mb-3"
          placeholder="Full name"
          value={name}
          onChange={(e) => {
            setNameTouched(true);
            setName(e.target.value);
          }}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && handleSave()}
        />

        <div className="flex gap-2 mb-5">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ background: c }}
              className={`w-6 h-6 rounded-full ${
                color === c ? "ring-2 ring-offset-2 ring-[var(--c-ink)]" : ""
              }`}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg hover:bg-black/5">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="text-sm px-4 py-2 rounded-lg bg-[var(--c-green)] text-white font-medium hover:bg-[#194a3b] disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add person"}
          </button>
        </div>
      </div>
    </div>
  );
}
