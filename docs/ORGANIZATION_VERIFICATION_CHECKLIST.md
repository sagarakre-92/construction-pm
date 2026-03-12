# Organization-aware foundations – manual verification checklist

Use this checklist to verify organization-aware behavior in a real environment (Supabase + app). Unit tests cover the app-layer logic; these steps cover DB, RLS, and full flows.

---

## 1. Project creation requires `organization_id`

- [ ] **RPC:** In Supabase SQL Editor, confirm that `orat_create_project` exists and sets `organization_id` from `orat_user_organization_id()` (see migration 008). New rows in `orat_projects` must have `organization_id` NOT NULL.
- [ ] **App:** As an authenticated user in an org, create a project from the UI. In Table Editor, confirm the new project row has `organization_id` set to your org’s id.
- [ ] **No org:** If possible, temporarily remove your user from `organization_members`. Create project should fail with an error (e.g. “User must belong to an organization” or “No organization”).

---

## 2. Existing projects are scoped to the default organization

- [ ] **Backfill:** After running migrations 007 and 008, all existing projects have `organization_id` set to the default org (e.g. `SELECT id, organization_id FROM orat_projects` shows no NULLs and all point to the same org).
- [ ] **UI:** Log in as a user in the default org. You see only projects for that org (no cross-org projects). Creating a project adds it to that org.

---

## 3. Task creation inherits or sets the correct `organization_id`

- [ ] **DB trigger:** In Supabase, confirm trigger `orat_tasks_sync_organization_id_trigger` exists (migration 009). Insert a task (via app or SQL with `project_id` set) and confirm the task row has `organization_id` equal to the project’s `organization_id`.
- [ ] **App:** Create a task from the UI in a project. In `orat_tasks`, the new task has `organization_id` matching the project’s `organization_id`.

---

## 4. Project queries are organization-scoped

- [ ] **API:** Call or trigger `getProjectsWithDetails()` (e.g. load the ORAT page). Only projects for the current user’s organization are returned (check network or server logs if needed).
- [ ] **RLS:** In Supabase, as the same user, run `SELECT * FROM orat_projects`. Only rows where `organization_id = orat_user_organization_id()` (and owner/member) are visible (migration 010).

---

## 5. Task queries are not global

- [ ] **API:** Tasks are only loaded as part of projects (e.g. `getProjectsWithDetails()` or project-scoped views). There is no “all tasks” query that ignores organization.
- [ ] **getTasksForProject:** If you have code or an API that fetches tasks by project, it must pass `organizationId` and filter by it (e.g. `getTasksForProject(projectId, organizationId)` in org-data).
- [ ] **RLS:** `orat_tasks` policies use `orat_can_access_project(project_id, auth.uid())`, which in 010 includes `project.organization_id = orat_user_organization_id()`, so task access is org-scoped.

---

## Gaps not covered by unit tests

- **RLS and DB constraints:** Enforced only in Supabase; verify with the steps above.
- **End-to-end create project → create task:** Full flow is best checked manually or with E2E tests (Playwright).
- **Multi-org behavior:** Current tests assume single-org; multi-org switching is not implemented or tested.

---

## Quick smoke test (single-company setup)

1. Log in as a user that belongs to the default organization.
2. Create a project; confirm it appears and has `organization_id` in the DB.
3. Create a task in that project; confirm the task has `organization_id` matching the project.
4. Open another project (same org); confirm you see only that org’s projects and tasks.
5. (Optional) In SQL, set one project’s `organization_id` to a different org; as the same user, confirm that project no longer appears in the app (org-scoped read).
