"use client";

import { useRef, useState } from "react";
import { Download, Upload, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { Project, Resource, Task } from "@/lib/types";
import {
  parseCSVFile,
  downloadCSV,
  PROJECT_TEMPLATE,
  PEOPLE_TEMPLATE,
  TASKS_TEMPLATE,
  normalizeStatus,
  normalizePriority,
  normalizeBool,
  normalizeDate,
  colorForIndex,
} from "@/lib/csvImport";

type Tab = "projects" | "people" | "tasks";

interface Props {
  projects: Project[];
  resources: Resource[];
  tasks: Task[];
  onClose: () => void;
  createProject: (name: string, color: string) => Promise<Project>;
  createResource: (name: string, color: string, email?: string | null) => Promise<Resource>;
  createTask: (input: Partial<Task>) => Promise<Task>;
  updateTask: (id: string, input: Partial<Task>) => Promise<Task>;
}

interface ImportResult {
  summary: string[];
  warnings: string[];
}

const TAB_CONFIG: Record<
  Tab,
  { label: string; template: string; filename: string; columns: string }
> = {
  projects: {
    label: "Projects",
    template: PROJECT_TEMPLATE,
    filename: "projects-template.csv",
    columns: "name (required), color (optional hex, e.g. #1F5C4A)",
  },
  people: {
    label: "People",
    template: PEOPLE_TEMPLATE,
    filename: "people-template.csv",
    columns: "name (required), email (optional), color (optional hex)",
  },
  tasks: {
    label: "Tasks",
    template: TASKS_TEMPLATE,
    filename: "tasks-template.csv",
    columns:
      "title (required), description, project, assigned_to, status (todo/in_progress/review/done), priority (low/medium/high/urgent), start_date, due_date, is_milestone (true/false), milestone_date, parent_task (title of another row, for subtasks)",
  },
};

export default function ImportModal({
  projects,
  resources,
  tasks,
  onClose,
  createProject,
  createResource,
  createTask,
  updateTask,
}: Props) {
  const [tab, setTab] = useState<Tab>("tasks");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetFileState() {
    setFileName(null);
    setRows([]);
    setResult(null);
    setParseError(null);
  }

  function switchTab(t: Tab) {
    setTab(t);
    resetFileState();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setParseError(null);
    try {
      const parsed = await parseCSVFile(file);
      if (parsed.rows.length === 0) {
        setParseError("That file has no data rows.");
        return;
      }
      setFileName(file.name);
      setRows(parsed.rows);
    } catch {
      setParseError("Couldn't read that file. Make sure it's a valid CSV.");
    }
  }

  async function runImport() {
    setImporting(true);
    setResult(null);
    try {
      if (tab === "projects") setResult(await importProjects(rows, projects, createProject));
      else if (tab === "people")
        setResult(await importPeople(rows, resources, createResource));
      else
        setResult(
          await importTasks(
            rows,
            projects,
            resources,
            tasks,
            createProject,
            createResource,
            createTask,
            updateTask
          )
        );
    } catch (err) {
      setResult({
        summary: [],
        warnings: [(err as Error).message || "Import failed unexpectedly."],
      });
    } finally {
      setImporting(false);
    }
  }

  const cfg = TAB_CONFIG[tab];

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 overflow-y-auto py-10"
      onClick={onClose}
    >
      <div
        className="bg-[var(--c-cream)] rounded-2xl w-full max-w-2xl shadow-2xl border border-[var(--c-line)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="font-display font-semibold text-base">Bulk import</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 flex gap-1 border-b border-[var(--c-line)]">
          {(Object.keys(TAB_CONFIG) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "border-[var(--c-green)] text-[var(--c-green)]"
                  : "border-transparent text-[#8a8578] hover:text-[var(--c-ink)]"
              }`}
            >
              {TAB_CONFIG[t].label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="text-xs text-[#8a8578] leading-relaxed">
            <span className="font-medium text-[#4d574f]">Columns: </span>
            {cfg.columns}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => downloadCSV(cfg.filename, cfg.template)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-[var(--c-line)] bg-white hover:bg-black/5"
            >
              <Download size={14} />
              Download template
            </button>
            <label className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-[var(--c-green)] text-white font-medium hover:bg-[#194a3b] cursor-pointer">
              <Upload size={14} />
              Choose CSV file
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="hidden"
              />
            </label>
            {fileName && <span className="text-xs text-[#8a8578] truncate">{fileName}</span>}
          </div>

          {parseError && (
            <div className="text-sm text-[#C23B3B] flex items-center gap-1.5">
              <AlertTriangle size={14} />
              {parseError}
            </div>
          )}

          {rows.length > 0 && !result && (
            <div className="border border-[var(--c-line)] rounded-lg overflow-hidden">
              <div className="px-3 py-2 text-xs font-medium text-[#8a8578] bg-white border-b border-[var(--c-line)]">
                {rows.length} row{rows.length === 1 ? "" : "s"} found — showing first 5
              </div>
              <div className="overflow-x-auto max-h-56">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-black/[0.02]">
                      {Object.keys(rows[0]).map((h) => (
                        <th key={h} className="text-left px-2 py-1.5 font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-t border-[var(--c-line)]">
                        {Object.keys(rows[0]).map((h) => (
                          <td key={h} className="px-2 py-1.5 whitespace-nowrap max-w-[160px] truncate">
                            {r[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-2">
              {result.summary.map((s, i) => (
                <div key={i} className="flex items-start gap-1.5 text-sm text-[#1F5C4A]">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                  {s}
                </div>
              ))}
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-sm text-[#8a4a1f]">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg hover:bg-black/5">
              {result ? "Done" : "Cancel"}
            </button>
            {!result && (
              <button
                onClick={runImport}
                disabled={rows.length === 0 || importing}
                className="text-sm px-4 py-2 rounded-lg bg-[var(--c-green)] text-white font-medium hover:bg-[#194a3b] disabled:opacity-50"
              >
                {importing
                  ? "Importing…"
                  : `Import ${rows.length || ""} row${rows.length === 1 ? "" : "s"}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Import logic ----

async function importProjects(
  rows: Record<string, string>[],
  existing: Project[],
  createProject: (name: string, color: string) => Promise<Project>
): Promise<ImportResult> {
  const existingNames = new Set(existing.map((p) => p.name.trim().toLowerCase()));
  let created = 0;
  let skipped = 0;
  const warnings: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = (row.name || "").trim();
    if (!name) {
      warnings.push(`Row ${i + 2}: missing "name", skipped.`);
      continue;
    }
    if (existingNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }
    const color = (row.color || "").trim() || colorForIndex(i);
    await createProject(name, color);
    existingNames.add(name.toLowerCase());
    created++;
  }

  const summary = [`${created} project${created === 1 ? "" : "s"} created.`];
  if (skipped) summary.push(`${skipped} skipped (already existed).`);
  return { summary, warnings };
}

async function importPeople(
  rows: Record<string, string>[],
  existing: Resource[],
  createResource: (name: string, color: string, email?: string | null) => Promise<Resource>
): Promise<ImportResult> {
  const existingNames = new Set(existing.map((r) => r.name.trim().toLowerCase()));
  let created = 0;
  let skipped = 0;
  const warnings: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = (row.name || "").trim();
    if (!name) {
      warnings.push(`Row ${i + 2}: missing "name", skipped.`);
      continue;
    }
    if (existingNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }
    const color = (row.color || "").trim() || colorForIndex(i);
    const email = (row.email || "").trim() || null;
    await createResource(name, color, email);
    existingNames.add(name.toLowerCase());
    created++;
  }

  const summary = [`${created} ${created === 1 ? "person" : "people"} added.`];
  if (skipped) summary.push(`${skipped} skipped (already existed).`);
  return { summary, warnings };
}

async function importTasks(
  rows: Record<string, string>[],
  existingProjects: Project[],
  existingResources: Resource[],
  existingTasks: Task[],
  createProject: (name: string, color: string) => Promise<Project>,
  createResource: (name: string, color: string, email?: string | null) => Promise<Resource>,
  createTask: (input: Partial<Task>) => Promise<Task>,
  updateTask: (id: string, input: Partial<Task>) => Promise<Task>
): Promise<ImportResult> {
  const projectMap = new Map(existingProjects.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const resourceMap = new Map(existingResources.map((r) => [r.name.trim().toLowerCase(), r.id]));
  const titleToId = new Map(existingTasks.map((t) => [t.title.trim().toLowerCase(), t.id]));

  let projectsCreated = 0;
  let peopleCreated = 0;
  let tasksCreated = 0;
  let subtasksLinked = 0;
  const warnings: string[] = [];

  const created: { id: string; parentTitle: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const title = (row.title || "").trim();
    if (!title) {
      warnings.push(`Row ${i + 2}: missing "title", skipped.`);
      continue;
    }

    let projectId: string | null = null;
    const projectName = (row.project || "").trim();
    if (projectName) {
      const key = projectName.toLowerCase();
      if (projectMap.has(key)) {
        projectId = projectMap.get(key)!;
      } else {
        const p = await createProject(projectName, colorForIndex(projectMap.size));
        projectMap.set(key, p.id);
        projectId = p.id;
        projectsCreated++;
      }
    }

    let assignedTo: string | null = null;
    const personName = (row.assigned_to || "").trim();
    if (personName) {
      const key = personName.toLowerCase();
      if (resourceMap.has(key)) {
        assignedTo = resourceMap.get(key)!;
      } else {
        const r = await createResource(personName, colorForIndex(resourceMap.size));
        resourceMap.set(key, r.id);
        assignedTo = r.id;
        peopleCreated++;
      }
    }

    const isMilestone = normalizeBool(row.is_milestone);
    const task = await createTask({
      title,
      description: (row.description || "").trim() || null,
      project_id: projectId,
      assigned_to: assignedTo,
      status: normalizeStatus(row.status) as Task["status"],
      priority: normalizePriority(row.priority) as Task["priority"],
      start_date: normalizeDate(row.start_date),
      due_date: normalizeDate(row.due_date),
      is_milestone: isMilestone,
      milestone_date: isMilestone ? normalizeDate(row.milestone_date) : null,
    });
    tasksCreated++;
    titleToId.set(title.toLowerCase(), task.id);
    created.push({ id: task.id, parentTitle: (row.parent_task || "").trim() });
  }

  for (const c of created) {
    if (!c.parentTitle) continue;
    const parentId = titleToId.get(c.parentTitle.toLowerCase());
    if (!parentId) {
      warnings.push(`Couldn't find parent task "${c.parentTitle}" — left as a top-level task.`);
      continue;
    }
    if (parentId === c.id) continue;
    await updateTask(c.id, { parent_task_id: parentId });
    subtasksLinked++;
  }

  const summary = [`${tasksCreated} task${tasksCreated === 1 ? "" : "s"} created.`];
  if (subtasksLinked) summary.push(`${subtasksLinked} linked as subtasks.`);
  if (projectsCreated)
    summary.push(`${projectsCreated} new project${projectsCreated === 1 ? "" : "s"} created along the way.`);
  if (peopleCreated)
    summary.push(`${peopleCreated} new ${peopleCreated === 1 ? "person" : "people"} added along the way.`);
  return { summary, warnings };
}
