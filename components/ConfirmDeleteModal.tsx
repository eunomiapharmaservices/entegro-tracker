"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export default function ConfirmDeleteModal({
  title,
  message,
  confirmText,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmText: string; // the exact text the person must type to unlock the delete button
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === confirmText;

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--c-cream)] rounded-2xl w-full max-w-sm shadow-2xl border border-[var(--c-line)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-base flex items-center gap-2 text-[#C23B3B]">
            <AlertTriangle size={17} />
            {title}
          </h2>
          <button onClick={onCancel} className="p-1 rounded-md hover:bg-black/5">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-[#4d574f] mb-4">{message}</p>
        <label className="text-xs font-medium text-[#8a8578] mb-1 block font-display">
          Type <span className="font-mono text-[var(--c-ink)]">{confirmText}</span> to confirm
        </label>
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && matches && onConfirm()}
          className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm bg-white outline-none focus:border-[#C23B3B] mb-4"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="text-sm px-4 py-2 rounded-lg hover:bg-black/5">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!matches}
            className="text-sm px-4 py-2 rounded-lg bg-[#C23B3B] text-white font-medium hover:bg-[#a52f2f] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}
