# Entegro Tracker

A task tracker for Entegro: kanban board, timeline (Gantt-style), and calendar
views over tasks, subtasks, and milestone dates, with resource assignment.
Built with Next.js 15 + Supabase, matching the stack used for the Entegro Hub
and Proofreader tools — deploys the same way, to Vercel.

## What it does

- **Board view** — tasks by status (To do / In progress / On hold / In review
  / Done), drag cards between columns.
- **Timeline view** — Gantt-style bars from start date to due date, subtasks
  nested under their parent, milestones shown as diamond markers.
- **Calendar view** — Month, Week, or Day view, highlighting milestone dates
  and task due dates, with a CSV export of what's currently displayed.
- **People dashboard** — one card per person showing their tasks grouped by
  project, with status, due dates, and an overdue count at a glance.
- **Tasks** — title, description, project, assignee, priority, status, start
  and due dates, an optional milestone flag + milestone date, subtasks (each
  subtask is its own task with `parent_task_id` set), and a timestamped
  comment log.
- No login — anyone with the link can use it, matching how you described the
  intended use. See the "Locking it down later" note below if you want to add
  auth down the line.

## 1. Set up Supabase

1. Go to [supabase.com](https://supabase.com) → create a new project (or use
   an existing one).
2. Open **SQL Editor → New query**, paste in the contents of
   `supabase/schema.sql`, and run it. This creates the `resources`,
   `projects`, and `tasks` tables, seeds Rashmi/Kiran/Uday as resources, and
   seeds two starter projects.
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Run locally (optional)

```bash
cp .env.local.example .env.local
# paste in your Supabase URL and anon key
npm install
npm run dev
```

Open http://localhost:3000.

## 3. Deploy to Vercel

Same flow as your other tools:

1. Push this folder to a new GitHub repo (e.g.
   `entegropharmaservices/entegro-tracker`).
2. In Vercel: **Add New → Project**, import that repo.
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Vercel auto-detects Next.js — no build settings needed.

After that, editing via the GitHub pencil-icon workflow you've used before
works the same way; Vercel redeploys on every push.

## Locking it down later

Right now Supabase Row Level Security policies are permissive (`using (true)`)
so anyone with the link can read and write — that's what "anyone can use it"
means in practice. If you later want to restrict who can edit:

- Add Supabase Auth (email/password or Google OAuth, same pattern as the
  Proofreader tool's NextAuth setup) and change the RLS policies in
  `supabase/schema.sql` to check `auth.uid()`.
- Or put the whole app behind Vercel's password protection (Pro plan) as a
  quick stop-gap.

## Project structure

```
app/page.tsx            Main dashboard (view switching, filters, search)
components/
  Sidebar.tsx            Nav, project filter, people filter
  KanbanBoard.tsx         Board view with drag-and-drop
  TimelineView.tsx        Gantt-style timeline
  CalendarView.tsx        Month calendar with milestones
  TaskModal.tsx           Create/edit task, subtasks, milestone toggle
  ProjectModal.tsx        Create a new project
  Avatar.tsx              Resource avatar (initials + colour)
lib/
  types.ts                Shared TypeScript types
  supabaseClient.ts        Supabase client
  useTaskData.ts           Data loading + create/update/delete
  dateUtils.ts             Date formatting helpers
supabase/schema.sql        Database schema — run this first
```

## Network / ops tracking fields

Tasks can now also capture (all optional, shown in the task modal):

- **Task type** — e.g. MRP Planning, Full Audit, Circuit Audit, Config
  Removal, GCR_MOP (free text, with suggestions from common values)
- **EID / circuit ID** and **Site name** — which site or circuit the task is
  about
- **Raised by** — who requested the task, separate from who it's assigned to
- **Date added**, **Actual completion** — alongside the existing start/due
  dates
- **Expected duration (h)** and **Actual time spent (h)**
- **Progress %** — a slider from 0–100; moving it to 100 marks the task Done,
  moving it above 0 moves a "To do" task to "In progress"
- **Comments** — a running-notes field, separate from the description

- **EID → Project**: if a task has an EID set, its project is automatically
  "EID - Site name" (e.g. "8232 - Boston"), created on the fly if it doesn't
  exist yet — matching the naming convention from the source workbook. The
  manual project picker only applies when there's no EID. This applies both
  in the task editor and during CSV import (the `project` column in a CSV row
  is ignored whenever that row has an `eid`).

If you already had the tracker deployed before this update, run
`supabase/migration_002_network_fields.sql` in the Supabase SQL editor once —
it adds these columns to your existing `tasks` table without touching your
data. New installs already have them via `schema.sql`.

## Comments, status, and task type updates

- **Raised by** is now a dropdown of your People list, instead of free text
  (still shows the existing value even if that person isn't in People yet).
- **Comments** are now a timestamped log rather than a single field — each
  entry is saved with the date/time it was added, so you can see a running
  history on a task. Anything imported into the old single `comments` column
  still shows at the top as an "Imported note".
- **Status** now includes **On hold**, alongside To do / In progress / In
  review / Done.
- **Task type** now includes **Training** in the suggestions list (still free
  text, so anything else works too).

If you already had the tracker deployed before this update, run
`supabase/migration_003_status_and_comments.sql` in the Supabase SQL editor —
it widens the status field and adds the comments log table.

## Exporting people and projects

Click the small download icon next to "Projects" or "People" in the sidebar
to export either list as a CSV — the mirror image of the import templates, so
round-tripping data (export, edit in a spreadsheet, re-import) works cleanly.

## Bulk import via CSV

Click **Import** in the top bar to bring in projects, people, or tasks in
bulk — useful for migrating an existing task list or spreadsheet in one go.

- Pick the tab for what you're importing, download the template CSV to see
  the expected columns, fill it in (in Excel, Numbers, Google Sheets — export
  as CSV), then upload it.
- **Projects**: `name`, `color` (optional).
- **People**: `name`, `email` (optional), `color` (optional).
- **Tasks**: `title`, `description`, `project`, `assigned_to`, `status`,
  `priority`, `start_date`, `due_date`, `is_milestone`, `milestone_date`,
  `parent_task`.
  - `project` and `assigned_to` are matched by name against what's already in
    the tracker — if a name doesn't exist yet, it's created automatically
    (e.g. importing a task assigned to someone new adds them as a person too).
  - `parent_task` should exactly match the `title` of another row in the same
    file, to import a subtask under its parent — order in the file doesn't
    matter, a task can reference a parent listed further down.
  - Rows that already exist by name (for Projects/People) are skipped rather
    than duplicated.
- You'll get a summary after each import (how many were created, skipped, or
  need attention) plus a warning for any row that couldn't be matched (e.g. a
  misspelled `parent_task`).

## Adding or removing people and projects

Both are managed right from the sidebar now:

- **People**: click the **+** next to "People" to add someone (name + a colour
  for their avatar). Hover over a person's row and click the trash icon to
  remove them — you'll get a confirmation first, and any tasks assigned to
  them become unassigned rather than being deleted.
- **Projects**: click the **+** next to "Projects" to add one. Hover over a
  project's row and click the trash icon to delete it — tasks in that project
  become unassigned from any project rather than being deleted.
