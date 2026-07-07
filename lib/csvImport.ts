import Papa from "papaparse";

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCSVFile(file: File): Promise<ParsedCSV> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => {
        resolve({
          headers: results.meta.fields || [],
          rows: results.data as Record<string, string>[],
        });
      },
      error: (err) => reject(err),
    });
  });
}

export function downloadCSV(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const PROJECT_TEMPLATE = `name,color
Client Delivery,#1F5C4A
Regulatory Filings,#E07A3E
`;

export const PEOPLE_TEMPLATE = `name,email,color
Rashmi Papneja,rashmi@entegro.com,#1F5C4A
Kiran,kiran@entegro.com,#E07A3E
`;

export const TASKS_TEMPLATE = `title,description,project,assigned_to,status,priority,start_date,due_date,is_milestone,milestone_date,parent_task
Draft transparency disclosure,France disclosure pack,Regulatory Filings,Rashmi Papneja,todo,high,2026-07-10,2026-07-24,false,,
Submit to authority,,Regulatory Filings,Rashmi Papneja,todo,high,,2026-08-01,true,2026-08-01,
Collect supporting documents,First step,Regulatory Filings,Kiran,todo,medium,2026-07-10,2026-07-15,false,,Draft transparency disclosure
`;

export const STATUS_VALUES = ["todo", "in_progress", "review", "done"];
export const PRIORITY_VALUES = ["low", "medium", "high", "urgent"];

export function normalizeStatus(v: string | undefined): string {
  const s = (v || "").trim().toLowerCase().replace(/\s+/g, "_");
  return STATUS_VALUES.includes(s) ? s : "todo";
}

export function normalizePriority(v: string | undefined): string {
  const p = (v || "").trim().toLowerCase();
  return PRIORITY_VALUES.includes(p) ? p : "medium";
}

export function normalizeBool(v: string | undefined): boolean {
  const s = (v || "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

export function normalizeDate(v: string | undefined): string | null {
  const s = (v || "").trim();
  if (!s) return null;
  // Accept YYYY-MM-DD directly; try to coerce other common formats loosely.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

const PALETTE = ["#1F5C4A", "#E07A3E", "#3B6E8F", "#8A5FB0", "#C23B3B", "#7A8B84"];
export function colorForIndex(i: number): string {
  return PALETTE[i % PALETTE.length];
}
