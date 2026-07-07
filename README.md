# Entegro Tracker

A task tracker for Entegro: kanban board, timeline (Gantt-style), and calendar
views over tasks, subtasks, and milestone dates, with resource assignment.
Built with Next.js 15 + Supabase, matching the stack used for the Entegro Hub
and Proofreader tools — deploys the same way, to Vercel.

## What it does

- **Board view** — tasks by status (To do / In progress / In review / Done),
  drag cards between columns.
- **Timeline view** — Gantt-style bars from start date to due date, subtasks
  nested under their parent, milestones shown as diamond markers.
- **Calendar view** — month grid highlighting milestone dates and task due
  dates.
- **Tasks** — title, description, project, assignee, priority, status, start
  and due dates, an optional milestone flag + milestone date, and subtasks
  (each subtask is its own task with `parent_task_id` set).
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

## Adding or removing people and projects

Both are managed right from the sidebar now:

- **People**: click the **+** next to "People" to add someone (name + a colour
  for their avatar). Hover over a person's row and click the trash icon to
  remove them — you'll get a confirmation first, and any tasks assigned to
  them become unassigned rather than being deleted.
- **Projects**: click the **+** next to "Projects" to add one. Hover over a
  project's row and click the trash icon to delete it — tasks in that project
  become unassigned from any project rather than being deleted.
