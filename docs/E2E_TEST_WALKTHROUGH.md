# End-to-End Test Walkthrough

A single sit-down test pass for every feature shipped on `feat/p0-integrated`.
Pre-seeded data (from `scripts/seed-dev.mjs`) is referenced throughout, so you
don't need to create test rows manually unless a step explicitly says so.

**Estimated time:** ~25-35 minutes for a full pass.

---

## Before you start

Make sure these are true:

- [ ] Dev server is running (`npm run dev`) — check the Cursor terminal panel
- [ ] You can open http://localhost:3000 in a browser
- [ ] You have the dev server terminal **visible somewhere** — invitation
      emails print there in console mode
- [ ] You have an **incognito/private window** ready (Chrome: Cmd+Shift+N,
      Safari: Cmd+Shift+N, Firefox: Cmd+Shift+P) — needed for invitation tests

**Test accounts** (created by the seed):

| Account | Email | Password | Notes |
|---|---|---|---|
| Admin / owner | `admin@orat.dev` | `orat-dev-admin-1234` | Owns ACME Construction |
| Invitee | `invitee@orat.dev` | `orat-dev-invitee-1234` | Not yet in any org |

**Pre-seeded tasks** in project "Lakeside Tower":

| # | Title | Status | Priority | Due | Assignee |
|---|---|---|---|---|---|
| T1 | Permit submission for floor plans | In Progress | High | 5d ago | Ada (admin) |
| T2 | Site walk with structural engineer | Not Started | Medium | today | Ada |
| T3 | Concrete pour scheduling | In Progress | Low | +3d | Ada |
| T4 | HVAC contractor RFP review | Not Started | High | +9d | Ada |
| T5 | Final landscaping plan signoff | Not Started | Medium | +20d | _none_ |
| T6 | Foundation inspection (passed) | Complete | Low | -7d | Ada |

---

## Phase 1 — First sign-in (sanity check, ~2 min)

- [ ] Open http://localhost:3000 → you land on a marketing/login page
- [ ] Click **Log in**
- [ ] Sign in as `admin@orat.dev` / `orat-dev-admin-1234`
- [ ] You're redirected to `/orat`
- [ ] Sidebar shows organization **ACME Construction**
- [ ] Sidebar lists project **Lakeside Tower**
- [ ] Click "Lakeside Tower" → you see the 6 seeded `[seed] T1`–`[seed] T6` tasks

> If you don't see the tasks: refresh the page once. If still empty,
> re-run `node --env-file=.env.local scripts/seed-dev.mjs` in a Cursor terminal
> and reload.

---

## Phase 2 — Board view: Overdue swimlane (~3 min)

Spec: `e2e/overdue-tasks-visible-on-board.feature`

- [ ] Click the **Board** tab
- [ ] Confirm column order, left to right: **Overdue → Not Started → In Progress → Complete**
- [ ] Find **T1** (Permit submission, High priority) — it should be in **Overdue**, NOT in "In Progress" (even though its stored status is "In Progress")
- [ ] Find **T6** (Foundation inspection, Complete) — it should be in **Complete**, NOT Overdue (despite having a past due date)
- [ ] Cards in the Overdue column should have a visible red accent / warning indicator
- [ ] Click into **T1** → change due date to a date 7 days from today → Save
- [ ] T1 should now appear in **In Progress**, not Overdue
- [ ] Click into T1 again → change due date back to a past date (e.g. 5 days ago) → Save → confirm it returns to Overdue

Optional drag-and-drop test:
- [ ] Drag T1 from Overdue → drop on **Complete** column
- [ ] T1 moves to Complete and disappears from Overdue

---

## Phase 3 — Task priority (~3 min)

Spec: `e2e/task-priority.feature`

- [ ] Stay on the Board → look at any card → confirm a priority badge (H / M / L or "High"/"Medium"/"Low") is visible
- [ ] **T1** and **T4** show **High** badges; **T2** and **T5** show **Medium**; **T3** and **T6** show **Low**
- [ ] Click **+ New Task** (or whatever the button is called)
- [ ] In the dialog, find the **Priority** field → confirm it defaults to **Medium**
- [ ] Set priority to **High** → fill in title "Test priority high" → save
- [ ] New task appears with the High badge

- [ ] Click an existing task (e.g. T3, currently Low) → change priority to High → save → badge updates immediately

- [ ] Switch to the **List** tab
- [ ] Confirm there's a "Priority" column with H/M/L values
- [ ] Click the "Priority" column header → tasks should sort High → Medium → Low (or vice versa on second click)

- [ ] Switch to the **Timeline** tab
- [ ] Hover any task bar → tooltip should mention the priority

- [ ] Refresh the page → all priorities you set persist

---

## Phase 4 — List view: Group-by (~4 min)

Spec: `e2e/group-tasks-in-list.feature`

- [ ] Switch to the **List** tab
- [ ] Find the **Group by** dropdown above the table → default is "None"

- [ ] Set Group by → **Status**
  - [ ] Tasks split under collapsible headers per status
  - [ ] Each header shows the count of tasks under it
  - [ ] T6 sits under "Complete"; T2/T4/T5 under "Not Started"; T3 under "In Progress"; T1 under "Overdue"

- [ ] Set Group by → **Assignee**
  - [ ] Tasks split per assignee
  - [ ] **T5** falls under an "Unassigned" group (it's the only one without an assignee)

- [ ] Set Group by → **Due date**
  - [ ] Headers in this order: **Overdue / Due today / This week / Next week / Later**
  - [ ] T1 → Overdue (5 days past); T2 → Due today; T3 → This week (+3d); T4 → Next week (+9d); T5 → Later (+20d); T6 → Overdue (past due, even though Complete — this is by design for "Due date" grouping)
  - [ ] The "Overdue" group is **expanded** by default

- [ ] Click a group header to collapse → tasks hide, count remains visible
- [ ] Click again to expand → tasks return

- [ ] With grouping active, click a sortable column header (e.g. Title) → sorting applies WITHIN each group
- [ ] Set Group by → **None** → table goes back to a single flat list

- [ ] Reload the page → the last Group-by choice you picked persists
- [ ] Switch to Board, then back to List → choice still persists (this proves it's saved across navigation)

---

## Phase 5 — Saved views (~5 min)

Spec: `e2e/saved-task-views.feature`

- [ ] Stay in List view (or use Board — your choice)
- [ ] Set some filters: e.g. assignee filter = **My tasks**, plus group-by = **Status**
- [ ] Find the **Saved views** menu (usually near the top of the dashboard) → click "Save current as..." (or similar)
- [ ] Name the view **"My weekly review"** → save
- [ ] **"My weekly review"** appears in the saved-views menu

- [ ] Reload the page → "My weekly review" is still in the menu (proves it persisted to the database, not just memory)

- [ ] Change the assignee filter to **All** (different from what you saved)
- [ ] Click "My weekly review" in the menu
- [ ] Filter snaps back to **My tasks** + group-by = Status
- [ ] URL bar shows `/orat?view=<some-uuid>` (this is the shareable link)

- [ ] While the view is open, change one filter (e.g. group-by → Assignee) → click **Update** (in the saved-views menu)
- [ ] Open a different view or navigate away, then re-open "My weekly review" → the new group-by is now the saved one

- [ ] Click **Copy share link** (or copy the URL from the address bar)
- [ ] In an incognito window, paste the URL → sign in as `admin@orat.dev` again → same filters apply (the link works)

- [ ] Back in the regular window: open the saved-views menu → **delete** "My weekly review" → it disappears

---

## Phase 6 — Org-wide invitations (~5 min)

Specs: `e2e/invitation-email-delivery.feature`, `e2e/pending-invitations-visible-and-managed.feature`

> **About email**: in dev/console mode, invitation emails print to the dev
> server terminal instead of being sent. Keep that terminal visible — you'll
> need to copy a link from it.

### Send the invitation
- [ ] In the app, click your avatar (top-right) → **Organization settings** (or navigate to `/orat/organization` directly)
- [ ] Find the **Invite member** form
- [ ] Email = `invitee@orat.dev`, role = **Member** (or whatever's available) → submit
- [ ] Form success message says something like "Invitation emailed to invitee@orat.dev"
- [ ] In your dev server terminal, you should see a log line like:
  ```
  [email] Would send to invitee@orat.dev: Invitation to join ACME Construction
  ```
  followed by a URL containing `/invite/<some-token>`

- [ ] **Copy** the full `/invite/<token>` URL from the terminal

### Pending list / resend / revoke
- [ ] Open the **Lakeside Tower** project → find the **Team / Members** view
- [ ] Confirm there's a **"Pending invitations"** section listing `invitee@orat.dev`
- [ ] Click **Resend** → confirmation toast → invitation row's "last sent" timestamp updates
- [ ] Check the terminal again → a second `[email] Would send to invitee@orat.dev:` log line appeared with the **same** token (same link)

> Don't revoke yet — you need it for Phase 7 if you want to test acceptance.
> If you'd rather test revoke: click **Revoke** + confirm → row disappears →
> open the link in incognito → "invitation is no longer valid" message →
> then send a fresh invitation for Phase 7.

### Accept the invitation
- [ ] Open an **incognito window** → paste the `/invite/<token>` URL from the terminal
- [ ] You'll be prompted to sign in → use `invitee@orat.dev` / `orat-dev-invitee-1234`
- [ ] After accepting, the invitee lands on `/orat` with a welcome message mentioning **ACME Construction**
- [ ] No specific project is auto-selected (this is correct for org-wide invitations)
- [ ] Sidebar shows ACME Construction and Lakeside Tower (because they're now an org member)

- [ ] Switch back to the regular browser (still signed in as admin)
- [ ] Reload the Members/Team view → `invitee@orat.dev` now appears in **Members**, NOT in Pending

---

## Phase 7 — Project-scoped invitations + Editor/Viewer roles (~7 min)

Specs: `e2e/invite-collaborator-to-project.feature`, `e2e/invitee-lands-on-invited-project.feature`

> **Setup**: First, sign out the invitee in the incognito window (or close
> incognito). And in the regular window, you may want to remove `invitee@orat.dev`
> from ACME Construction so the next test is clean — OR just use a different
> email for this phase. Easiest: use `editor@orat.dev` (a fresh fake email) +
> create the user via incognito signup mid-flow. Use whichever you prefer.

### Send a project-scoped invitation as Editor
- [ ] Signed in as admin → open **Lakeside Tower** project → Team / Members view
- [ ] Click **Invite to project** (this is a different button from the org-wide one)
- [ ] Fill in:
  - Email: `editor@orat.dev` (or another fresh address)
  - First name: `Eddie` · Last name: `Editor` · Title: `MEP Lead`
  - Role: **Editor**
- [ ] Submit → invitation appears in **"Pending project invitations"** for Lakeside Tower
- [ ] Row shows the project role: **Editor**
- [ ] In the dev terminal, copy the new `/invite/<token>` URL

### Accept as Editor
- [ ] Open a fresh incognito window → paste the URL
- [ ] If `editor@orat.dev` doesn't exist yet, you'll be prompted to **Sign up** — do so with password `editor1234` (or anything 8+ chars)
- [ ] After signup + accept, the invitee lands on `/orat?project=<id>&welcome=1`
- [ ] **Lakeside Tower** is auto-selected in the sidebar
- [ ] A toast appears: **"Welcome to Lakeside Tower"**
- [ ] As Eddie (Editor):
  - [ ] You **can** see the **+ New Task** button
  - [ ] You **can** create a new task → it appears
  - [ ] You **can** drag tasks between Board columns
  - [ ] You **can** open and edit any existing task

### Send a project-scoped invitation as Viewer
- [ ] Switch back to the admin browser → Lakeside Tower → Team view
- [ ] Click **Invite to project** again
- [ ] Email: `viewer@orat.dev` · Name: `Vicky Viewer` · Role: **Viewer**
- [ ] Submit → copy `/invite/<token>` from terminal

### Accept as Viewer
- [ ] Fresh incognito window → paste URL → sign up `viewer@orat.dev` / `viewer1234`
- [ ] After accept, lands on Lakeside Tower with welcome toast
- [ ] As Vicky (Viewer):
  - [ ] You can OPEN a task and read its details
  - [ ] You **do NOT** see the "+ New Task" button (or it's disabled)
  - [ ] You **cannot** drag tasks between Board columns
  - [ ] Editing the task either isn't possible or fields are read-only

### Edge case: invalid invitation
- [ ] In admin browser, send a fresh invite to `revoked@orat.dev` → copy the link
- [ ] Then immediately revoke that invitation in the Pending list
- [ ] Paste the link in a fresh incognito → expect a clear "invitation is no longer valid" message (no redirect into the app)

---

## Phase 8 — Regression sweep (~5 min)

Quick smoke test that the older features still work after the P0 changes.

- [ ] Sign out (in any browser) → confirm you're returned to the marketing/login page (no JavaScript errors in browser console)
- [ ] Sign back in as `admin@orat.dev`
- [ ] Create a new project from the sidebar (e.g. "Test Project Two") → it appears
- [ ] Inside that new project, create a task with all fields filled (title, description, dates, assignee, company, meeting reference) → save → reopen → all fields persisted
- [ ] Drag the task between Board columns → status updates (refresh — change persists)
- [ ] Switch through Board → List → Timeline tabs → no console errors (open DevTools: Cmd+Opt+I → Console tab)
- [ ] Delete the test task → disappears immediately, stays gone after refresh
- [ ] Archive "Test Project Two" via the project settings menu → it disappears from the active sidebar

---

## Done

If every box above is checked, P0 is good to ship to staging/prod.

Things this checklist does **not** cover (intentional — they're P1 follow-ups):
- Real-time updates (two browsers viewing the same board don't auto-sync — refresh required)
- Notifications other than invitations (assignment / due-date reminders)
- Comments / mentions on tasks
- Client/customer entity layer

---

## If something is broken

Don't try to debug it yourself — copy the following into a chat message:

1. Which Phase + step number
2. What you saw vs. what was expected
3. Any red text in the browser console (DevTools → Console tab)
4. Any red text in the dev server terminal

Then ask for help.
