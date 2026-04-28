# P0 Testing Checklist

Local pre-deploy verification for the P0 epic on `feat/p0-integrated`.
Each section maps to a beads issue and its `e2e/*.feature` acceptance spec.

---

## 0. One-time setup

```
- [ ] git fetch && git checkout feat/p0-integrated
- [ ] git log --oneline 7da650b..HEAD     # confirm 13 commits present
- [ ] npm install                          # no new deps were added but safe to re-run
- [ ] npm run lint                         # must be clean
- [ ] npm run test:run                     # must show 8 files / 94 tests passing
- [ ] npm run build                        # must compile cleanly
```

### Apply migrations to your local Supabase

Open the Supabase SQL editor (or use `supabase db push` if your CLI is wired)
and apply IN ORDER:

```
- [ ] supabase/migrations/018_add_task_priority.sql       # adds priority column
- [ ] supabase/migrations/019_saved_views.sql             # new orat_saved_views table + RLS
- [ ] supabase/migrations/020_project_invitations.sql     # extends invitations + project_role
```

After each, spot-check in the Table Editor that the columns/tables landed.

### Environment additions

Append to `.env.local` (see `.env.local.example` for the new keys):

```bash
# Optional — invitation emails. Without it, emails go to stdout (dev mode).
RESEND_API_KEY=
EMAIL_FROM="ORAT <noreply@your-domain>"
```

```
- [ ] Decide: real email (set RESEND_API_KEY) or console mode (leave blank)
- [ ] If real email: get a Resend test API key + a verified sender domain
```

### Test data prerequisites

You will need:

```
- [ ] At least 2 Supabase test users (admin + invitee)
- [ ] An existing organization with at least 1 project containing 4+ tasks
- [ ] At least one task with a past due date (for overdue testing)
- [ ] At least one task with a future due date (for "due this week" bucket)
```

### Start the app

```
- [ ] npm run dev
- [ ] open http://localhost:3000 and sign in
```

---

## 1. Story `orat-apw` — Overdue swimlane on the Board

Spec: `e2e/overdue-tasks-visible-on-board.feature`

```
- [ ] Open a project's Board view
- [ ] Verify column order is: Overdue → Not Started → In Progress → Complete
- [ ] An "Overdue" column exists even when there are 0 overdue tasks
- [ ] A task whose stored status is "In Progress" but whose due date is in the past
      appears ONLY in the "Overdue" column (not in "In Progress")
- [ ] A task with status="Complete" and a past due date appears in "Complete"
      (NOT in "Overdue")
- [ ] Open an overdue task, change its due date to next week, save
        ⤷ task moves out of "Overdue" into the column matching its stored status
- [ ] Drag an overdue task to "Complete"
        ⤷ task moves to "Complete" and disappears from "Overdue"
- [ ] Cards in the "Overdue" column have a visible red accent / overdue indicator
```

---

## 2. Story `orat-uk8` — Task priority

Spec: `e2e/task-priority.feature` · Migration **018**

```
- [ ] Open the Create Task dialog
        ⤷ Priority Select is present, defaults to "Medium"
- [ ] Create a task with priority "High"
        ⤷ task list shows the High priority indicator on the card
- [ ] Open an existing task, change priority Medium → High, save
        ⤷ all views (Board, List, Timeline) reflect the new priority
- [ ] On the Board, every card shows a priority indicator
- [ ] On the List, the Priority column header is sortable
        ⤷ ascending sort orders High → Medium → Low
- [ ] On Timeline, hovering a bar shows the priority in the tooltip
- [ ] Create a task without picking a priority
        ⤷ saved priority is "Medium" (verify in DB or by reopening the task)
- [ ] Refresh the page — all priorities persist
```

---

## 3. Story `orat-den` — Group-by in the List view

Spec: `e2e/group-tasks-in-list.feature`

```
- [ ] Switch to the List view
- [ ] Find the "Group by" Select above the table; default is "None"
- [ ] Group by "Status"
        ⤷ tasks split under collapsible headers per status, each header shows count
- [ ] Group by "Assignee"
        ⤷ headers per assignee; tasks with no assignee fall under "Unassigned"
- [ ] Group by "Project" (only meaningful in All Projects view)
        ⤷ headers per project name
- [ ] Group by "Due date"
        ⤷ headers: Overdue · Due today · This week · Next week · Later
        ⤷ "Overdue" group is expanded by default
- [ ] Click a group header to collapse it; the tasks hide but the count stays visible
- [ ] Set grouping back to "None"
        ⤷ table goes back to single sortable list
- [ ] Sorting (click a column header) still works while grouped
        (sort applies WITHIN each group)
- [ ] Reload the page
        ⤷ your group-by choice persists (stored in localStorage)
- [ ] Switch to Board, then back to List
        ⤷ group-by choice still persists
```

---

## 4. Story `orat-gb0` — Saved & shareable filtered views

Spec: `e2e/saved-task-views.feature` · Migration **019**

```
- [ ] On the dashboard, set some filters:
        - select a project
        - filter assignee to "My tasks"
        - (optionally) group by something
- [ ] Open the "Saved views" menu and click "Save current as…"
- [ ] Name the view "Test view A" and save
        ⤷ "Test view A" appears in the menu
- [ ] Reload the page
        ⤷ "Test view A" still appears in the menu
- [ ] Open "Test view A"
        ⤷ URL becomes /orat?view=<id>
        ⤷ all the captured filters are re-applied
- [ ] Change one filter while in a saved view, click "Update"
        ⤷ next time you open the view, the new filter is applied
- [ ] Click "Copy share link" while a saved view is loaded
        ⤷ the URL with ?view=<id> is in your clipboard
- [ ] Open that link in an incognito window, sign in as a DIFFERENT user
      who is in the SAME organization
        ⤷ they see the same filters applied (within their RLS scope)
- [ ] Sign in as a user from a DIFFERENT organization
        ⤷ they cannot load the view (RLS blocks; expect empty/redirect)
- [ ] Delete "Test view A" from the menu
        ⤷ it disappears from your menu (and from any teammate's menu)
```

---

## 5. Story `orat-8za` — Invitation emails delivered

Spec: `e2e/invitation-email-delivery.feature`

### Console mode (RESEND_API_KEY unset)

```
- [ ] Tail the dev server logs in your terminal
- [ ] Sign in as admin, open Organization settings, send an invitation
        ⤷ console logs "[email] Would send to <email>: <subject>"
- [ ] Form success message reads "Invitation emailed to <email>"
        (NOT the old "email not sent yet" copy)
```

### Real-send mode (RESEND_API_KEY set)

```
- [ ] Set RESEND_API_KEY and EMAIL_FROM in .env.local, restart dev server
- [ ] Send an invitation to an inbox you control
        ⤷ email arrives within ~30s
        ⤷ subject mentions your organization name
        ⤷ body contains a CTA button → /invite/<token>
- [ ] Click the link in the email
        ⤷ opens the accept page; sign in as the invitee
        ⤷ invitee is added to the organization
- [ ] Misconfigure the API key (set to garbage), retry an invite
        ⤷ form shows a clear error (no orphaned pending row created)
```

### Resend behavior

```
- [ ] In ProjectTeamView, find a pending invitation, click "Resend"
        ⤷ a new email is delivered with the SAME token (same link)
        ⤷ row's "last sent" timestamp updates
```

---

## 6. Story `orat-ov9` — Pending invitations visible & manageable

Spec: `e2e/pending-invitations-visible-and-managed.feature`

```
- [ ] Sign in as admin
- [ ] Send a fresh invitation to "test+pending@example.com"
- [ ] Open ProjectTeamView for any project
        ⤷ "Pending organization invitations" section lists the new pending invite
        ⤷ each row shows email, role, and date sent
- [ ] Click "Resend"  ⤷ confirmation toast; timestamp updates
- [ ] Click "Revoke" + confirm
        ⤷ row disappears from Pending list
        ⤷ open the original /invite/<token> link in incognito
            → see "invitation has been revoked" / "no longer valid" message
- [ ] Sign in as a NON-admin org member, open ProjectTeamView
        ⤷ Pending list is visible
        ⤷ Resend / Revoke controls are NOT shown
- [ ] Send a fresh invite, accept it as the invitee
        ⤷ accepted invitation leaves the Pending list
        ⤷ invitee shows up in the Members list
```

---

## 7. Story `orat-pjv` — Project-scoped invitations

Spec: `e2e/invite-collaborator-to-project.feature` · Migration **020**

⚠️ **Trade-off note**: a project-scoped invitee is currently added to
`organization_members` as `member` (so existing RLS lets them read what they
need). The `project_role` column gates EDIT capabilities. The "true external
collaborator" model is a planned P1 follow-up.

### Editor flow

```
- [ ] Sign in as admin/owner of org with at least 2 projects (e.g. "Lakeside Tower" + "Acme HQ")
- [ ] Open ProjectTeamView for "Lakeside Tower"
- [ ] Click "Invite to project" — a new ProjectInviteForm opens
- [ ] Fill in: email, first/last name, title, role = "Editor"
- [ ] Submit
        ⤷ invitation appears under the project's "Pending project invitations" section
        ⤷ project role "Editor" is shown on the row
        ⤷ email is delivered (or console-logged) with project name in subject
- [ ] Open the invitation link in incognito, sign in as the invitee
        ⤷ Editor lands on "Lakeside Tower" board (welcome toast — see story 8)
        ⤷ Editor can: create a task, edit a task, drag between columns
        ⤷ Editor IS in the Project Members list
```

### Viewer flow

```
- [ ] As admin, send a project-scoped invitation with role = "Viewer"
- [ ] Accept as a third user in incognito
        ⤷ Viewer can OPEN tasks (read-only)
        ⤷ Viewer does NOT see "Create Task" button
        ⤷ Viewer cannot drag tasks between Board columns
        ⤷ Viewer cannot open the task edit dialog (or sees fields disabled)
```

### Existing org-wide invitations still work

```
- [ ] Send an org-wide invite from Organization settings (the original form)
        ⤷ lands in the org-wide Pending list
        ⤷ on accept, invitee sees ALL projects in the org
```

---

## 8. Story `orat-kti` — Invitee landing page

Spec: `e2e/invitee-lands-on-invited-project.feature`

```
- [ ] Project-scoped invitee accepts → /orat?project=<id>&welcome=1
        ⤷ that project is auto-selected in the sidebar
        ⤷ a sonner toast appears: "Welcome to <project name>"
- [ ] Org-wide invitee accepts → /orat (no specific project)
        ⤷ welcome toast mentions the organization name
- [ ] Open a revoked or expired invitation link
        ⤷ accept page shows a clear "no longer valid" message
        ⤷ no redirect happens
- [ ] Open a project-scoped invite link while signed in as a DIFFERENT user
      (e.g. you are admin of Org A; the invite is for Pat for Project B in Org C)
        ⤷ you see a confirmation prompt before being switched
        (or, if not implemented, document the actual behavior)
```

---

## 9. Regression — does anything that used to work still work?

```
- [ ] Sign up + email verification flow still works
- [ ] Login redirects existing users to /orat
- [ ] First-time user goes through onboarding (org creation)
- [ ] Create a project from the sidebar
- [ ] Create a task in a project (existing form still saves all fields)
- [ ] Edit an existing task — all old fields (title/description/dates/assignee/company/meeting ref) still save
- [ ] Drag a task between Board columns — status updates and reorders within column persist
- [ ] Bulk-select tasks — copy-as-text still works
- [ ] Switch between Board / List / Timeline tabs — no console errors
- [ ] /orat/organization page renders members + (now also) pending invitations correctly
- [ ] Sign out works without "[object Event]" error
- [ ] Delete a task — disappears optimistically, persists on refresh
- [ ] Project archive (settings menu) still works
```

---

## 10. Pre-deploy gate

```
- [ ] All boxes above checked
- [ ] npm run lint              ✔ clean
- [ ] npm run test:run          ✔ 94 / 94 passing
- [ ] npm run build             ✔ compiles
- [ ] npm run test:e2e          (optional but recommended; needs E2E_EMAIL/PASSWORD)
- [ ] Migrations applied to STAGING Supabase as well as local
- [ ] RESEND_API_KEY set in production env (Vercel) if email send is required
- [ ] EMAIL_FROM set in production env to a verified sender domain
- [ ] Decide merge strategy: fast-forward feat/p0-integrated → main, or
       cherry-pick the 5 feature commits + 2 fix commits onto a clean main
```

---

## Known limitations to verify behave as designed

```
- [ ] Project-scoped invitees ARE in organization_members (intentional trade-off
      to keep existing RLS working; document if this is acceptable for your launch)
- [ ] Real-time updates do NOT happen — two browsers viewing the same board
      need refresh to see each other's changes (P1 follow-up)
- [ ] No notifications other than invitations (assignment / due-date reminders
      are P1; see e2e/due-date-email-reminders.feature for the planned spec)
- [ ] No comments on tasks yet (P1; see e2e/task-comments-and-mentions.feature)
- [ ] No client/customer entity yet (P1; see e2e/clients-organize-projects.feature)
```

---

## Rollback plan if something breaks in staging

```
- [ ] git revert <merge-commit-of-failing-story>
- [ ] If a migration causes problems:
      - 020: drop project_id / project_role columns from organization_invitations
             and orat_project_members; drop orat_create_project_invitation
             and orat_accept_project_invitation
      - 019: drop orat_saved_views table
      - 018: drop priority column from orat_tasks
      (Each migration is idempotent on the way IN; rollbacks are manual SQL.)
- [ ] Redeploy from main without the offending merge
```
