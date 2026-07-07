"use client";

import { useState } from "react";
import { X } from "lucide-react";

const COLOR_OPTIONS = ["#1F5C4A", "#E07A3E", "#3B6E8F", "#8A5FB0", "#C23B3B", "#7A8B84"];

export default function ResourceModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, color: string) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);

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
          <h2 className="font-display font-semibold text-base">New person</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5">
            <X size={18} />
          </button>
        </div>
        <input
          autoFocus
          className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm bg-white outline-none focus:border-[var(--c-green)] mb-3"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
            {saving ? "Adding…" : "Add person"}
          </button>
        </div>
      </div>
    </div>
  );

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim(), color);
    setSaving(false);
    onClose();
  }
}
