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

export const TASKS_TEMPLATE = `title,description,project,assigned_to,status,priority,start_date,due_date,is_milestone,milestone_date,parent_task,task_type,eid,site_name,raised_by,expected_duration_hours,actual_time_spent_hours,date_added,actual_completion,progress_percent,comments
Complete MRP and update NAT,,,Srihari,in_progress,high,2026-07-06,2026-07-07,false,,,MRP Planning,6986,Charlotte,Gokul,4,,2026-07-07,,80,7-June: completed MRP need to review and update nat
Complete Audit and add circuits to ISV,,,Radhika,done,high,2026-07-01,2026-07-07,false,,,Full Audit,8232,Boston,Gokul,,,2026-07-07,2026-07-07,100,
Draft transparency disclosure,France disclosure pack,Regulatory Filings,Rashmi Papneja,todo,high,2026-07-10,2026-07-24,false,,,,,,,,,,,0,
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

export function normalizeNumber(v: string | undefined): number | null {
  const s = (v || "").trim();
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

export function normalizeProgress(v: string | undefined): number {
  const n = normalizeNumber(v);
  if (n === null) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

const PALETTE = ["#1F5C4A", "#E07A3E", "#3B6E8F", "#8A5FB0", "#C23B3B", "#7A8B84"];
export function colorForIndex(i: number): string {
  return PALETTE[i % PALETTE.length];
}
