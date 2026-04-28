# ORAT Roadmap

What's planned beyond the P0 epic that just shipped on `feat/p0-integrated`.
This document is a strategic narrative; the source of truth for every line item
is its **beads issue** (`bd show <id>`).

The ordering reflects **impact on the team's ability to align on what to follow
up on** — the lens that defined P0 — extended outward to multi-firm reality
and construction-specific maturity.

---

## Done — P0 (shipped on `feat/p0-integrated`)

For reference. All 8 issues closed; see `docs/P0_TESTING_CHECKLIST.md`.

| ID | Title | Spec |
|---|---|---|
| `orat-apw` | Overdue swimlane on the Board | `e2e/overdue-tasks-visible-on-board.feature` |
| `orat-uk8` | Task priority H/M/L | `e2e/task-priority.feature` |
| `orat-den` | Group-by in the List view | `e2e/group-tasks-in-list.feature` |
| `orat-gb0` | Saved & shareable filtered views | `e2e/saved-task-views.feature` |
| `orat-8za` | Send invitation emails automatically | `e2e/invitation-email-delivery.feature` |
| `orat-ov9` | Pending invitations visible & manageable | `e2e/pending-invitations-visible-and-managed.feature` |
| `orat-pjv` | Project-scoped invitations | `e2e/invite-collaborator-to-project.feature` |
| `orat-kti` | Invitee lands on invited project | `e2e/invitee-lands-on-invited-project.feature` |

---

## Now — P1 with stories ready to estimate

These have written acceptance specs and could be picked up immediately.

### `orat-4e5` — Clients organize projects · **L**

> **Story:** `e2e/clients-organize-projects.feature`

Add a first-class **Client** entity. Projects roll up to a client. Filter the
dashboard, sidebar, and metrics by client. Without this, an owner's rep
running multiple clients can't answer *"what's open for Acme?"* across
projects — just `company` strings on tasks.

**Touches:** new migration (`orat_clients` table + RLS + `client_id` on
`orat_projects`), `types.ts`, `org-data.ts`, `actions.ts`, `ProjectsPanel`,
`page.tsx` filter chips, `DashboardMetrics`.
**Depends on:** none. Standalone.

---

### `orat-coj` — Email reminders for assignments and due dates · **M**

> **Story:** `e2e/due-date-email-reminders.feature`

Email on assignment, 3-day pre-due reminder, daily overdue digest, opt-out.
Currently the product is an *action tracker* with no automated nudges — the
biggest functional gap left after P0.

**Touches:** scheduler (Vercel Cron or Supabase pg_cron), reuse the
`@/lib/email` module from P0, `notification_preferences` table, opt-out UI
under `/orat/organization`.
**Depends on:** none — `@/lib/email` already exists from P0.

---

### `orat-818` — Task comments with @mentions · **M**

> **Story:** `e2e/task-comments-and-mentions.feature`

Comment thread on tasks; `@mention` notifies project members; edit/delete own
comment; mention suggestions scoped to the project's team. Pulls coordination
out of email/Slack and back next to the work.

**Touches:** new `orat_task_comments` table + RLS, mention parser, in-app
notification surface (chip count + dropdown), reuse email module for mention
notifications.
**Depends on:** soft dep on Real activity log (`orat-usx`) for nicer
"who said what" history; not a blocker.

---

## Next — P1 needing design before estimation

### `orat-lm4` — Real-time board updates · **M-L**

Two browsers viewing the same board today need refresh to see each other's
edits. Add Supabase Realtime subscriptions on `orat_tasks` so drags / edits /
creations propagate live. Optional: presence avatars showing who else is
looking.

**Open design questions:** conflict resolution when two users drag-reorder
the same column simultaneously (last-write-wins on `sort_order` is wrong);
scoping subscriptions to the current project to avoid noise; presence vs
heartbeat strategy. Worth a short design doc before sprinting.

**Depends on:** none.

---

### `orat-tfb` — True external collaborator model · **L** (TECH DEBT FROM P0)

P0's `orat-pjv` made a pragmatic trade-off: project-scoped invitees ARE added
to `organization_members` (role=`member`) on accept. This works because
existing RLS on `orat_projects` / `orat_tasks` admits any org member, and the
`project_role` column gates EDIT capability at the application layer.

The *real* model is a project-scoped collaborator who is **not** in
`organization_members` and reaches the right rows via RLS that admits
`orat_project_members.project_id`. That requires:

- New SELECT policies on `orat_projects`, `orat_tasks`, `orat_project_members`,
  `orat_external_stakeholders`, `orat_saved_views` admitting the project
  membership path
- INSERT/UPDATE/DELETE gating against `project_role = 'editor'`
- Migration to remove the `organization_members` row for users whose only
  access is project-scoped

**Depends on:** must land before `orat-evd` (cross-org collaborators) — that
feature is impossible without this model.

---

## Later — P2 (this year; each needs scoping)

These are real construction-PM gaps but each is a meaningful epic. Listed in
rough strategic priority order.

| ID | Title | Why it matters | Effort | Depends on |
|---|---|---|---|---|
| `orat-72e` | **Multi-org per user (workspace switcher)** | An OR genuinely consults for two firms; today they need separate logins. | L | none |
| `orat-evd` | **Cross-org collaborators on a project** | Invite a contractor from a different firm to one project. | L | `orat-tfb`, `orat-72e` |
| `orat-747` | **Attachments on tasks** (photos, PDFs, drawings) | Punch lists with photos; meeting-note PDFs; drawings in context. | M | none |
| `orat-pph` | **Task dependencies and blockers** | "Waiting on submittal" is the #1 coordination signal in construction. | L | none |
| `orat-eqn` | **Gantt zoom + drag-to-reschedule + full horizon** | Today fixed to ±7 days; useless for macro schedules. | M | none |
| `orat-yf4` | **Weekly status report export per client** | ORs deliver these manually today. | M | `orat-4e5` (need Client entity to scope reports) |
| `orat-usx` | **Real activity log to replace `history` JSON** | Audit + accountability; `"Current User"` strings aren't enough. | M | none |
| `orat-531` | **Construction primitives (RFIs, submittals, change orders)** | First-class workflows. Each is its own epic. | XL | `orat-747` (attachments needed for submittals) |
| `orat-mpw` | **Mobile site-walk experience** | Touch-first capture; offline drafts; phone-friendly status change. | L | none |

---

## How to read this doc

- **Beads ID** is the source of truth. Run `bd show <id>` for the full description, dependencies, and history.
- **Effort sizing** is rough: **S** = ≤2 days, **M** = ≤1 week, **L** = ≤2 weeks, **XL** = larger / multi-sprint.
- **Story file** (where listed) is the Gherkin acceptance spec; treat it as the contract.
- **Depends on** flags hard sequencing only. Soft preferences are noted in prose.

## How to start work

```bash
bd ready                          # see what's available with no blockers
bd update <id> --claim            # atomically claim it
# … do the work …
bd close <id>                     # mark complete
bd dolt push                      # sync (or let git hooks handle it)
```

Follow the project skills as you go:
- `.cursor/skills/add-supabase-migration/SKILL.md` for any DB change
- `.cursor/skills/write-user-story/SKILL.md` for new acceptance specs
- `.cursor/skills/write-e2e-test/SKILL.md` for Playwright coverage
- `.cursor/skills/tdd/SKILL.md` for the implementation loop

## When to revisit this roadmap

- After every shipped epic — re-rank P2 items as user feedback comes in
- When external pressure changes (a new client demands Feature X)
- Quarterly at minimum — reorder, re-scope, or drop items that no longer earn their place

---

## Stories that exist but live in P0+ as planning artifacts

These were written during the analysis pass and aren't tied to any P1/P2
issue yet. They're useful starting points if any of these jump tiers:

- `e2e/clients-organize-projects.feature` → `orat-4e5` (now P1)
- `e2e/due-date-email-reminders.feature` → `orat-coj` (now P1)
- `e2e/task-comments-and-mentions.feature` → `orat-818` (now P1)

Stories not yet written (would block their issue from "ready" until done):
- `orat-lm4` real-time board updates
- `orat-tfb` true external collaborator model
- All P2 issues (intentional — write the story when scope is firmed up)
