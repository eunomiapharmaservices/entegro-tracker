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
  project, with status, progress %, due dates, and an overdue count at a
  glance.
- **List view** — every task in a sortable table (Task, Assigned to, EID,
  Site name, Task type, Status, Date added, Date completed).
- **Tasks** — title, description, project, assignee, priority, status, start
  and due dates, an optional milestone flag + milestone date, subtasks (each
  subtask is its own task with `parent_task_id` set), and a timestamped
  comment log.
- **Login required** — registration is limited to `@lumen.com` email
  addresses, with a basic password policy. See "Login and registration"
  below.
- **Assignment emails** — assigning someone to a task sends them an email
  with the task details, if they have an email address on file and email
  sending is configured. See "Task assignment emails" below.

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
4. **Decide on email confirmation for sign-ups**, under **Authentication →
   Providers → Email**:
   - Leave **Confirm email** ON (the default) if you want Supabase to email
     people a confirmation link before they can sign in — no extra setup,
     Supabase sends this itself.
   - Turn it OFF if you'd rather people get instant access right after
     registering, since this is a small internal team. Either is fine; OFF is
     simpler for a first rollout.

## 2. Run locally (optional)

```bash
cp .env.local.example .env.local
# paste in your Supabase URL, anon key, and (optionally) Resend details
npm install
npm run dev
```

Open http://localhost:3000 — you'll land on `/login` since the app now
requires an account. Click "Register" to create the first one.

## 3. Deploy to Vercel

Same flow as your other tools:

1. Push this folder to a new GitHub repo (e.g.
   `entegropharmaservices/entegro-tracker`).
2. In Vercel: **Add New → Project**, import that repo.
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (optional — only needed for
     assignment emails; see below)
4. Deploy. Vercel auto-detects Next.js — no build settings needed.

After that, editing via the GitHub pencil-icon workflow you've used before
works the same way; Vercel redeploys on every push.

## Login and registration

- Go to `/register` to create an account. Registration is limited to
  `@lumen.com` email addresses (checked in the browser) — change this in
  `lib/auth.ts` (`ALLOWED_EMAIL_DOMAIN`) if the domain is ever different.
- Password policy: at least 8 characters, one uppercase letter, one
  lowercase letter, one number. Shown live on the registration form.
- Once signed in, every page requires a valid session — there's no more
  "anyone with the link" access. Sign out from the bottom of the sidebar.
- **Worth knowing**: the `@lumen.com` domain check happens in the browser,
  which stops normal sign-ups from other domains but wouldn't stop someone
  deliberately calling the Supabase Auth API directly with a different
  email. `supabase/migration_005_auth.sql` has an optional note on closing
  that gap server-side via a Supabase Auth Hook, if that level of hardening
  matters for your use case.
- If you already had the tracker deployed before this update, run
  `supabase/migration_005_auth.sql` in the Supabase SQL editor — it switches
  every table's access policy from "anyone" to "must be signed in". Do this
  only after you've registered at least one account, or you'll lock
  yourself out of the data (you can still register/sign in either way, just
  the data screens would show empty/error until an account exists).

## Task assignment emails

Assigning someone to a task — through the task editor, drag-and-drop on the
board, or CSV import — sends them an email with the task's details (title,
type, project, site/EID, due date, priority), as long as:

1. That person has an email address set on their People entry, and
2. Email sending is configured (below).

If either isn't true, nothing breaks — the task save just proceeds without
sending anything.

**Setup** (5 minutes):

1. Sign up at [resend.com](https://resend.com) (free tier: 100 emails/day,
   3,000/month — plenty for a small team).
2. **Verify a domain you own** under **Domains** in the Resend dashboard —
   this is the domain emails are sent *from*, not the recipient's domain, so
   it does **not** need to be `lumen.com`. Any domain you control works (e.g.
   `entegropharma.com` or a subdomain of it). Follow Resend's DNS
   instructions; verification usually takes a few minutes.
3. Create an API key under **API Keys** → copy it into `RESEND_API_KEY`.
4. Set `RESEND_FROM_EMAIL` to an address on your verified domain, e.g.
   `"Entegro Tracker <notifications@entegropharma.com>"`.
5. Add both env vars in Vercel (**Settings → Environment Variables**) and
   redeploy.

Only re-assignment triggers an email — editing other fields on an
already-assigned task doesn't re-send it.

## Locking it down further

Login now covers "who can get into the app at all." If you later want
per-person permissions (e.g. only certain people can delete projects or
edit others' tasks), that would mean moving beyond the current "any signed-in
user can do anything" model into role-based policies — a bigger change than
what's here now. Ask if that becomes a priority.

## Project structure

```
app/page.tsx            Main dashboard (view switching, filters, search)
app/login/page.tsx       Sign in
app/register/page.tsx    Registration (domain + password checks)
app/api/notify-assignment/route.ts   Sends assignment emails via Resend
components/
  AuthGate.tsx           Redirects to /login if not signed in
  Sidebar.tsx            Nav, project filter, people filter, sign out
  KanbanBoard.tsx         Board view with drag-and-drop
  TimelineView.tsx        Gantt-style timeline
  CalendarView.tsx        Month calendar with milestones
  TaskModal.tsx           Create/edit task, subtasks, milestone toggle
  ProjectModal.tsx        Create a new project
  Avatar.tsx              Resource avatar (initials + colour)
lib/
  types.ts                Shared TypeScript types
  supabaseClient.ts        Supabase client
  auth.ts                  Email domain + password validation
  notifyAssignment.ts      Client helper for assignment emails
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
- **Comments** are a timestamped log — each entry records who posted it and
  when (date + time), with a "Post" button next to the comment box.
- **Commenting as** — set your name once at the bottom of the sidebar and
  it's remembered on that browser/device, so comments get attributed to you
  automatically without reselecting every time. There's no login behind
  this — it's just a convenience, not access control; anyone can change it
  (including on someone else's device), and each comment box still lets you
  pick a different name for that one entry if needed.
- **Status** now includes **On hold**, alongside New / In progress / In
  review / Completed (renamed from "To do" and "Done").
- **Task type** now includes **Training** in the suggestions list (still free
  text, so anything else works too).
- **Completed tasks drop off the board after 14 days.** This only ever
  applies to tasks whose status is Completed — a task that's simply overdue
  (still New, In progress, On hold, or In review) is never hidden by this
  rule, no
  matter how old it is. The moment a task's status becomes Completed, its
  completion date is stamped automatically (unless you'd already set one
  manually). The board only shows Completed tasks finished within the last 14
  days — older ones are hidden from the board but still fully there in List,
  Timeline, Calendar, and People views. A small note at the bottom of the
  board tells you how many are hidden this way.
- **Actual completion** in the task editor is greyed out and only editable
  once status is Completed — it fills in automatically the moment you mark a
  task Completed (via the status dropdown, the progress slider, or the
  subtask checkboxes), so you don't need to set it by hand.
- **Task type, EID, and Expected duration are now required** when creating or
  editing a task through the editor — the Save button is disabled and a red
  note lists whatever's still missing. This only applies to the main task
  editor; quick subtask entries and CSV bulk import stay flexible (a subtask
  is meant to be a lightweight checklist item, and an import may come from a
  source that doesn't track hours or EIDs).
- **Status changes are logged automatically.** Change a task's status and hit
  Save (or Create task), and a comment gets added to that task's log —
  `Status changed from "X" to "Y"` — attributed to whoever's set as
  "Commenting as" at the time. This only fires from the task editor's Save
  button right now; dragging a card between board columns or ticking a
  subtask done doesn't log a status-change comment (those still update status
  itself, just without the log entry).

## Display fixes

- **Timeline now shows day numbers**, not just the month, in a row under the
  month header — weekends are lightly shaded and today is highlighted.
- **Projects in the sidebar are sorted** (numeric-aware, so EID-prefixed
  names like "6986 - Charlotte" sort in numeric order rather than
  alphabetical-string order, where "10000" would otherwise sort before
  "6986").
- **Fixed a date bug**: due dates, milestones, and the 14-day completed-task
  filter could show a task one day later than its actual date, depending on
  your timezone (anything ahead of UTC, which includes the UK during BST).
  This is fixed at the source, so it self-corrects across Calendar, Board,
  and Timeline without needing to touch your data.

If you already had the tracker deployed before this update, run
`supabase/migration_003_status_and_comments.sql` and
`supabase/migration_004_auto_completion_date.sql` in the Supabase SQL editor
(in that order) — they widen the status field, add the comments log table,
and add the auto-completion-date trigger.

## List view

A **List** item in the sidebar shows every task in a filterable, sortable
table — Task, Assigned to, Project, EID, Site name, Task type, Status,
Progress, Date added, Date completed.

- Click any column header to sort by it (click again to reverse).
- Each column has its own filter box right under the header — type in any of
  them to narrow the list; filters combine (all active ones apply together).
- Select rows with the checkboxes (or the header checkbox for all currently
  filtered rows) to **export just the selected rows** or **delete them in
  bulk**, both from a small toolbar that appears above the table.
- Subtasks are shown indented under their parent with a ↳ marker.

## Exporting people, projects, and tasks

- Click the small download icon next to "Projects" or "People" in the
  sidebar to export either list as CSV — the mirror image of the import
  templates, so round-tripping (export, edit, re-import) works cleanly.
- Click **Export tasks** in the top bar to export every task in the database
  as CSV, in the same column format the bulk importer expects — regardless of
  any project/person filter or search currently applied in the sidebar.

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

## Adding, archiving, and removing people and projects

- **People**: click the **+** next to "People" to add someone (name + a
  colour for their avatar). Hover a person's row and click the trash icon to
  remove them — this now requires typing their exact name to confirm (a
  deliberate speed bump, not real access control — there's still no login, so
  this is about preventing accidental clicks, not restricting who can do it).
  Their tasks become unassigned rather than being deleted.
- **Projects — archive instead of delete**: hover a project's row and click
  the archive icon to move it out of the active list — for when you're done
  working an EID/site and don't want it cluttering the sidebar forever, without
  losing the history. Archived projects collapse into an "Archived (N)" section
  further down; click to expand it, and you can still filter tasks by an
  archived project the same way as an active one.
  - **Restore**: click the restore icon on an archived project to bring it back
    to the active list.
  - **Delete permanently**: only available on archived projects, and requires
    typing the exact project name to confirm. Tasks in a deleted project
    become unassigned rather than being deleted themselves.
  - The manual "Project" dropdown when editing a task hides archived projects
    by default (so new tasks don't get pointed at closed-out sites), except
    the one a task is already assigned to, which still shows so you can see
    or change it.

