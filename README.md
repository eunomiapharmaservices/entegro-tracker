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

- Go to `/register` to create an account. Registration requires **both**:
  - An `@lumen.com` email address (change the domain in `lib/auth.ts` —
    `ALLOWED_EMAIL_DOMAIN` — if that's ever different), and
  - Being on the **allowed emails list** — a specific set of pre-approved
    addresses, not just anyone on the domain. Manage this list via **Manage
    access** at the bottom of the sidebar once you're signed in: add an email
    (with an optional note) before that person can register: attempting to
    register with an address that isn't listed is blocked with a clear
    message.
- Password policy: at least 8 characters, one uppercase letter, one
  lowercase letter, one number. Shown live on the registration form.
- Once signed in, every page requires a valid session — there's no more
  "anyone with the link" access. Sign out from the bottom of the sidebar.
- If you already had the tracker deployed before this update, run
  `supabase/migration_006_allowed_emails.sql`, then add at least one allowed
  email (via **Manage access** once you can sign in, or directly in SQL) —
  otherwise no one new can register at all.
- **Worth knowing**: the domain and allowlist checks happen in the browser,
  which stops normal sign-ups but wouldn't stop someone deliberately calling
  the Supabase Auth API directly. `supabase/migration_005_auth.sql` has an
  optional note on closing that gap server-side via a Supabase Auth Hook, if
  that level of hardening matters for your use case.
- If you already had the tracker deployed before the *previous* update, run
  `supabase/migration_005_auth.sql` in the Supabase SQL editor — it switches
  every table's access policy from "anyone" to "must be signed in." Do this
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

## People linked to email — with a name suggestion

Adding a person now asks for their email first, then suggests a name from
it (e.g. `dharmeshkumar.mehta@lumen.com` → "Dharmeshkumar") — edit the
suggestion however you like, it's just a starting point. The email is what
lets a People entry connect to a login account for role grouping (see
below) and lets that person receive assignment emails.

For anyone already in the People list from before this, or added without an
email, Admins/Super can now **edit** an existing person — hover their row in
the sidebar and click the pencil icon to add or change their email, name, or
colour, without having to delete and re-add them.

## People list grouped by role (Admin/Super)

For Admins/Super Users, the sidebar's **People** list is grouped by login
role — Super User, Admin, Normal User, View Only, and "No login yet" for
anyone without a matching account — matched by comparing each person's email
to the registered accounts. Drag a person into a different category to
change their role (or set the role they'll get once they register, if they
don't have an account yet). Normal and View Only users see the plain list,
unchanged, since they can't see or act on role data anyway.

This only works for people who have an email set on their People entry — if
someone's missing one, they show up under "No login yet" and dragging them
prompts you to add an email first.

## Roles: Super User, Admin, Normal User, View Only

Every account has one of four roles, set when they're invited (and
changeable later by an Admin or Super User):

| | Super User | Admin | Normal User | View Only |
|---|---|---|---|---|
| View Board / Timeline / Calendar / List / People | ✓ | ✓ | ✓ | ✓ |
| Add / edit tasks, post comments | ✓ | ✓ | ✓ | ✗ |
| Export (people, projects, tasks) | ✓ | ✓ | ✓ | ✓ |
| **Import** (CSV) | ✓ | ✓ | ✗ | ✗ |
| **Delete tasks** (editor, or bulk in List) | ✓ | ✓ | ✗ | ✗ |
| **Manage projects** (add, archive/restore) | ✓ | ✓ | ✗ (view/select only) | ✗ (view/select only) |
| **Invite / remove user accounts** | ✓ | ✓ | ✗ | ✗ |
| **Change roles/privileges** | ✓ (any role) | Normal/View Only only | ✗ | ✗ |
| **View the Comment Log** (every comment, across all tasks) | ✓ | ✓ | ✗ | ✗ |

Admin and Super share almost everything. The one nuanced difference: an
Admin can set someone's role to **Normal User or View Only** (routine
day-to-day access changes — e.g. moving someone to View Only when they roll
off active work), but only a **Super User** can grant **Admin or Super**
itself. That way privilege escalation always needs a Super's say-so, while
Admins can still handle everyday access management on their own. This is
enforced at the database level, not just hidden in the UI, so it holds even
if someone calls the API directly. Inviting, removing accounts, and
everything else in Manage Users works the same for both.

**Multi-select in Manage Users**: tick the checkbox on any registered
account (or "Select all") to bulk-apply a role change, export the selection
as CSV, or delete several accounts at once — the bulk role dropdown only
offers roles you're actually allowed to grant.

**View Only** opens tasks in a read-only version of the editor — every field
is greyed out, there's no Save button (just "Close"), no way to add a
subtask or post a comment, and dragging a card between board columns doesn't
do anything. They see everything everyone else sees; they just can't change
any of it.

**Setting it up:**

1. Run `supabase/migration_007_roles.sql`, then `migration_008_view_only_role.sql`,
   then `migration_009_super_only_roles.sql`
   (after `migration_005_auth.sql` and `migration_006_allowed_emails.sql`, if
   you haven't already run those).
2. **Bootstrap your first Super User directly in SQL** — the in-app "Manage
   users" panel itself requires being an Admin/Super to see, so the very
   first one has to be set up outside the app:
   ```sql
   insert into allowed_emails (email, role) values ('sulabh@lumen.com', 'super')
   on conflict (email) do update set role = 'super';
   ```
   Then have that person register normally at `/register` — their account
   automatically gets the Super role from the allowlist entry.
3. Once signed in as Super/Admin, use **Manage users** (bottom of the
   sidebar) for everyone else: invite an email with a role, or change an
   existing account's role, or delete an account entirely. The "Registered"
   list is grouped by role (Super User / Admin / Normal User / View Only) so
   it's easy to see who's in which tier at a glance.
4. If people had already registered *before* these migrations, back-fill
   their roles once via SQL (the migration files have commented-out examples
   ready to edit with your real emails):
   ```sql
   update profiles set role = 'super' where lower(email) = lower('sulabh@lumen.com');
   update profiles set role = 'admin' where lower(email) in
     (lower('dharmeshkumar.mehta@lumen.com'), lower('gokul@lumen.com'));
   update profiles set role = 'view' where lower(email) = lower('someone@lumen.com');
   ```

**Deleting a user account** needs one more piece of setup: a
`SUPABASE_SERVICE_ROLE_KEY` environment variable (Project Settings → API →
`service_role` key in Supabase). This key bypasses all security rules, so:

- **Never** prefix it with `NEXT_PUBLIC_` — it must only exist server-side.
- It's used exclusively by `/api/admin/delete-user`, which independently
  re-checks the caller's role server-side before deleting anything — a
  Normal or View Only user calling that endpoint directly would still be
  rejected, even with a valid session.
- Without this key set, role changes still work fine (that's a normal
  database update) — only the "delete this account entirely" button will
  fail with a clear error until it's configured.

**What "Manage projects" restriction actually covers**: Normal users can
still view, filter by, and select projects — including having a new one
auto-created behind the scenes when they type a brand-new EID while creating
a task (that's core to how normal task creation works for the network-ops
side of the tracker). What they can't do is use the sidebar's manual "add
project" button, or archive/restore an existing one — those stay Admin/Super
only.

## Matrix view

A new **Matrix** item in the sidebar is a proper analytics dashboard, not
just a chart:

- **Summary cards** — Total tasks, Completed, Active, and Overdue, at a
  glance. Click any of them (they're highlighted when active) to see the
  matching tasks in the panel at the bottom, same as clicking a bar or a
  progress row.
- **Bar chart** — task counts grouped by any of Status/Assigned to/Project/
  **Task Type** (defaults to Assigned to), colored consistently with the
  rest of the app (status colors, each project's/person's own color). Click
  a bar to see the matching tasks below.
- **Donut chart** — a breakdown by whichever of the four categories you pick
  as the "split," with a small legend and counts.
- **Progress list** — one row per group (matching whichever axis the bar
  chart is grouped by), showing task count, % complete, an Active/Done
  badge, and a progress bar. Click a row for the same task drill-down as the
  bar chart.

Available to everyone, including View Only, since it's aggregate counts
rather than editable data.

**Task Type grouping**: when Task Type is used as an axis, every GCR-family
type (GCR_Support, GCR_MOP, etc.) is consolidated into one **GCR** category
— matching the Board's GCR lane — so you can track GCR work as a whole
without it splitting across near-identical type names. Every other task
type keeps its own individual category.

## Task type locked after creation (Normal users)

Once a task is saved, **Task type** can only be changed by Admin/Super —
Normal users can still set it when first creating a task, but it becomes
read-only on an existing one, with a note explaining why. This is a UI-level
safeguard (not enforced at the database level), aimed at preventing
accidental recategorization once work is underway.

## Duplicate a task

The task editor now has a **Duplicate** button next to Delete task (anyone
who can edit tasks can use it, not just Admin/Super). It creates a fresh
copy with " (Copy)" appended to the title, carrying over the project,
assignees, task type, EID, site, priority, and dates — but resets status to
New, progress to 0%, and clears any dependency/actual completion, so it
starts clean rather than inheriting the original's progress. A small
confirmation shows the new task's name; the original stays open so you can
duplicate again or keep editing it.

## GCR lane on the Board

The Board has an extra lane at the end, **GCR**, pulling together every task
whose type is in the GCR family — GCR_Support, GCR_MOP, or any other
variation starting with "GCR" — regardless of its status, alongside their
normal status column, not instead of it. Each card here shows a small status
pill since it's not organized by column position like the rest of the
board. Dragging a card from here into a status column still changes its
status as usual.

## Comment Log (Admin/Super)

A **Log** item appears in the sidebar for Admin/Super only, showing every
comment across every task — including the automatic "Status changed from…",
"Task created", and "Task deleted" entries — newest first, searchable by
comment text, person, or task name. Click any entry to jump to that task.
Normal and View Only users don't see this nav item at all.

## Deleting a task keeps its history

Deleting a task (Admin/Super only) no longer removes it from the database —
it's a soft delete. The task disappears from Board, Timeline, Calendar,
List, and People, but its full comment log (including every status change
and the new "Task created"/"Task deleted" entries) stays intact and visible
in the Comment Log forever, tagged with a red "Deleted" badge if you open it
from there. This is enforced at the database level too — only Admin/Super
can actually mark a task deleted, even via a direct API call.

If you already had the tracker deployed before this update, run
`supabase/migration_013_soft_delete_tasks.sql`.

## Task created / deleted logging

Every task now gets a "Task created" comment the moment it's saved (and
subtasks get their own entry too), and "Task deleted" is logged right before
a task disappears — so the Comment Log is a genuine end-to-end record of
what happened to every task, not just its status changes.

## People dashboard excludes View Only accounts

The **People** dashboard (workload-by-project view) no longer shows a card
for anyone whose linked login account is View Only — they're not part of
the assignable workforce, so an always-empty card added noise rather than
value. This is based on the same email-matching used for the sidebar's
role grouping, so it applies regardless of who's viewing the dashboard.

## Unique Task ID

Every task now gets a unique, human-readable ID the moment it's created —
`YYMMDD-HHMMSS` (e.g. `260708-120927` for 8 July '26 at 12:09:27), with a
`-1`, `-2`… suffix appended only in the rare case two tasks are created in
the exact same second. It's permanent once set, shown at the top of the task
editor, and available as its own column in the List view (sortable and
filterable, same as every other column) and in the full task export.

If you already had the tracker deployed before this update, run
`supabase/migration_010_task_number.sql` first if you haven't (adds the
column), then `migration_012_short_task_id.sql` — it switches to the shorter
format and regenerates every existing task's ID to match, using each task's
real creation time.

## Project structure

```
app/page.tsx            Main dashboard (view switching, filters, search)
app/login/page.tsx       Sign in
app/register/page.tsx    Registration (allowlist + password checks)
app/api/notify-assignment/route.ts   Sends assignment emails via Resend
app/api/admin/delete-user/route.ts   Deletes a user account (Admin/Super only)
components/
  AuthGate.tsx           Redirects to /login if not signed in
  ManageUsersModal.tsx    Invite/role/delete accounts (Admin/Super only)
  Sidebar.tsx            Nav, project filter, people filter, sign out
  KanbanBoard.tsx         Board view with drag-and-drop
  TimelineView.tsx        Gantt-style timeline
  CalendarView.tsx        Month/Week/Day calendar with milestones
  TaskModal.tsx           Create/edit task, subtasks, milestone toggle
  ProjectModal.tsx        Create a new project (Admin/Super only)
  Avatar.tsx              Resource avatar (initials + colour)
lib/
  types.ts                Shared TypeScript types
  supabaseClient.ts        Supabase client
  auth.ts                  Email domain + password validation
  useUserRole.ts           Current user's role (super/admin/normal)
  useManageUsers.ts        Allowlist + profile management for admins
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
- **Who's commenting is automatic now that login exists.** There's no more
  picker — comments (and the status-change log entries below) are always
  attributed to whoever's actually signed in. The name shown is your matching
  People entry if your login email matches one, otherwise your login email
  itself. The sidebar footer shows "Signed in as [name]" so it's always
  visible who you're posting as.
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
- **Status changes are logged automatically**, from any of the three places
  status can change — the task editor's Save button, dragging a card between
  board columns, or ticking a subtask's checkbox. Each logs a comment like
  `Status changed from "X" to "Y"`, attributed to whoever's signed in.

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

## Due date changes are logged automatically

Any real change to a task's due date now logs a comment — "Due date changed
from X to Y" (or "set to"/"cleared" for the first-time/removed cases) — no
matter where the change comes from: a manual edit, CSV import, or the
On Hold/In Review auto-extension bake-in below. This is enforced at the
database level, so it catches every path rather than just the task editor.

If you already had the tracker deployed before this update, run
`supabase/migration_017_log_due_date_change.sql`.

## Multiple assignees per task

A task can now be assigned to more than one person — "Assigned to" in the
editor is a checklist instead of a single dropdown. The board shows small
stacked avatars for everyone assigned (up to 3, with a "+N" overflow badge).
The first person checked stays the "primary" assignee behind the scenes, so
existing behavior (People dashboard grouping, assignment emails, filtering)
keeps working — but now every checked person gets included in all of that,
not just the first.

If you already had the tracker deployed before this update, run
`supabase/migration_018_multi_assignee.sql` — it adds the column and
backfills everyone's existing single assignment into the new list.

## Filter by Unassigned

The sidebar's People section now has an "Unassigned" option right below
"Everyone" — click it to see only tasks with nobody assigned, across Board,
Timeline, Calendar, List, and People.

## Delete task — error visibility

If deleting a task or bulk-deleting from List view ever fails, you'll now
see an actual error message explaining why, instead of it just silently not
happening. If Admin delete still doesn't work for you after this update,
check that all the migrations through `migration_013` (soft delete) have
actually been applied — the error message should now tell you exactly what
Postgres is objecting to.

## Predefined subtasks

The task editor now shows a few quick-add chips above the subtask
input — "Collect supporting documents," "Verify configuration," "Get
approval / sign-off," "Update documentation," "Notify stakeholders" — click
one to add it instantly instead of typing it out. Each one disappears from
the suggestions once it's already been added to that task.

## Due date extends automatically while On Hold

While a task sits in **On Hold**, its due date effectively grows by one day
for every day that passes — starting from the date it entered that status.
This shows up everywhere the due date appears (Board cards, List, Timeline,
Calendar, People) as soon as you load the page — it doesn't wait for any
daily job, since it's computed live from "how many days has this been on
hold" rather than a value that gets rewritten day by day in the database.
An extended date shows a small ⏳ next to it.

The moment the task leaves On Hold (moved to New, In progress, In Review, or
Completed), whatever the extended date was at that instant gets permanently
saved as the real due date, and the counter resets — so nothing keeps
silently growing once it's no longer stuck.

A couple of notes:
- The **task editor's Due date field** always shows and lets you edit the
  original stored value — the extension is explained in a small note
  underneath while the task is on hold, rather than changing what the field
  itself displays.
- **List view's "Export selected"** reflects the extended date (it mirrors
  what's on screen) — but the main **"Export tasks"** button in the top bar
  exports the raw stored value, since that export is meant to round-trip
  with CSV import and shouldn't bake in a live-computed extension.

**In Review works differently** — see the Review workflow below.

If you already had the tracker deployed before this update, run
`supabase/migration_016_hold_review_due_date_extension.sql`, then
`supabase/migration_019_review_workflow.sql` (which narrows the On Hold
extension to exclude In Review, since In Review now has its own mechanism).

## Review workflow

Moving a task to **In Review** now does three things automatically:

1. **Its due date freezes** — no more daily growth like On Hold. It stays
   exactly where it was until the review task below finishes.
2. **A duplicate task is spawned**, titled `"<original title> Review"`,
   carrying over the same project/task type/EID/site, assigned to whoever
   you've picked in the task editor's **Reviewer** field — or, if that's
   left blank, whoever's named in **Raised by** (matched to a People entry
   by name). Only unassigned if neither is set/matched.
3. **The original task gets linked to it** via the existing **Depends on**
   field — so you can see the connection right there, and it behaves like
   any other dependency in the UI.

When that review task is marked **Completed**, however many days the review
actually took (its completion date minus the date it was created) gets
**added onto the original task's due date** — not just "start the day
after," like a normal dependency, but a real extension by however long the
review consumed. That change shows up in the task editor immediately and
gets logged in the comment log like any other due date change.

This all happens at the database level via triggers, so it works regardless
of how a task enters Review — the editor, drag-and-drop on the board, or a
CSV import setting status directly to "review."

If you already had the tracker deployed before this update, run
`supabase/migration_019_review_workflow.sql`, then
`supabase/migration_020_review_task_raised_by_fallback.sql` (adds the
Raised by fallback described above).

## Task dependencies

Any task can now depend on another one, via the **Depends on** field in the
editor (between Due date and the milestone toggle). Once the task it depends
on is marked **Completed**, this task's **Start date** is automatically set
to the day after that completion date — and keeps updating automatically if
the completion date ever changes later.

This works no matter how the dependency gets marked done — through the
editor, dragging a card on the board, or a bulk CSV import — since it's
enforced at the database level, not just in the task editor's UI.

A couple of things worth knowing:
- If you pick a dependency that's *already* completed, the start date is set
  immediately when you save — no need to wait for anything to change.
- Because the cascade happens in the database, a teammate's screen might
  take up to the usual 60-second background refresh to visually show a
  dependent task's new start date — it's already correct in the database
  immediately, just not necessarily reflected on-screen for other people
  until their next refresh.
- There's a basic guard against the simplest cycle (two tasks depending on
  each other directly), but deeper chains (A → B → C → A) aren't checked —
  keep dependency chains straightforward.

If you already had the tracker deployed before this update, run
`supabase/migration_015_task_dependencies.sql`.

## Task editor refinements

- **Date added** now defaults to today automatically for new tasks — no need
  to pick it, though you still can if it should be backdated.
- **Picking an existing project auto-fills EID and site name.** Project
  names created from an EID follow the pattern "EID - Site" (e.g.
  "6986 - Charlotte") — selecting one of those from the Project dropdown now
  parses that back out and fills the EID/site fields, so the mandatory EID
  requirement is satisfied without retyping something you just picked.
- **Project dropdown is now sorted** the same numeric-aware way as the
  sidebar, so EID-prefixed project names are easy to scan in order.
- **Site name is now mandatory**, same as Task type, EID, and Expected
  duration. It's also auto-formatted as you type — first letter capitalized,
  everything else lowercase (e.g. typing "CHARLOTTE" becomes "Charlotte").
- **Three new task type suggestions**: NAT Updates, Flight Deck, Admin Work
  (alongside the existing ones — still free text, so anything works).
- **Projects can be renamed** — Admin/Super see a pencil icon on hover next
  to each project in the sidebar to edit its name or colour, for fixing
  typos without having to archive and recreate it.

## Calendar refinements

- **Completed tasks no longer appear** on the calendar in any view — once a
  task is Completed, it's done, so it drops off Month/Week/Day (it's still
  fully visible in List, Timeline, Board, and People).
- **Only due dates are shown, not start dates.** Day view previously also
  listed tasks starting that day; that's been removed everywhere for
  consistency — the calendar now shows exactly two things: a task's due date
  and any milestone date, matching Month and Week view.

## Keeping data in sync

The app now refreshes data from the database every 60 seconds in the
background, so changes made by someone else on a different device show up
without needing a manual page reload. Your own edits still feel instant —
they update on-screen immediately and don't wait for the next refresh cycle.

## List view

A **List** item in the sidebar shows every task in a filterable, sortable
table — Task, Assigned to, Project, EID, Site name, Task type, Status,
Progress, Due date, Date completed.

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

## Projects — who can add/archive/delete

This is now governed by the role system above rather than being universally
locked down:

- **Admin/Super** see a "+" next to "Projects" in the sidebar to add one, and
  an archive icon on hover to move a project out of the active list (for
  closed-out EIDs/sites) — with a matching restore icon in the collapsed
  "Archived (N)" section. There's no "delete permanently" for projects;
  archiving is as final as it gets from the UI.
- **Normal users** don't see any of those controls — they can still view,
  filter by, and select any active project, and new projects still get
  auto-created behind the scenes when they enter a new EID on a task (that
  keeps working regardless of role, since it's core to normal task entry).
- **People** now have the same treatment as Projects: Admin/Super see a "+"
  to add someone and a trash icon on hover to remove them (their tasks
  become unassigned, not deleted). Normal users can still view, filter by,
  and select any person — same pattern as Projects.

