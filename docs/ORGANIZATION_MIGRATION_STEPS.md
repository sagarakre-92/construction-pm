# Organization migration – what’s done and what you need to do

The app is being made **organization-aware** while still behaving like a single-company app. Step 1 (additive schema only) is implemented.

---

## What’s already implemented

- **Migration `005_organizations_additive.sql`** (in `supabase/migrations/`):
  - **`organizations`** table: `id`, `name`, `created_at`, `updated_at`
  - **`organization_members`** table: `(organization_id, user_id)`, `role` (admin/member), **unique on `user_id`** (one org per user)
  - **`orat_projects.organization_id`**: nullable FK to `organizations` (existing projects stay `NULL`)
  - RLS: users can **select** organizations they belong to and their own row in `organization_members`. No INSERT from client yet (reserved for a future RPC).
  - **`orat_user_organization_id()`**: SECURITY DEFINER function that returns the current user’s `organization_id` (for future RLS or app code)

- **Migration `006_organizations_slug.sql`**: Adds `slug` (unique, not null) to `organizations`; backfills existing rows.

- **Migration `007_seed_default_organization.sql`**: Inserts one default organization when none exist (idempotent). Placeholder name/slug: **My Company** / **my-company** — customize in the migration file before running, or `UPDATE public.organizations SET name = '...', slug = '...' WHERE slug = 'my-company';` after.

- **Migration `008_projects_require_organization.sql`** (Step 4): Adds existing project owners to the default org; backfills all projects to that org; makes `orat_projects.organization_id` NOT NULL with FK ON DELETE RESTRICT; updates `orat_create_project` so new projects get `organization_id` from the current user’s org. **Requires 007 to have been run first.**

- **Step 5 (code):** Project queries are organization-scoped. `getCurrentOrganization()` returns the current user’s org; `getProjectsForOrganization(organizationId)` fetches projects for that org; `getProjectsWithDetails()` uses the current org and returns only that org’s projects. UI unchanged; data access is org-aware.

- **Migration `009_tasks_organization_id.sql`** (Step 6): Adds `organization_id` to `orat_tasks`, backfills from parent project, NOT NULL, FK to `organizations`, index, and trigger so `task.organization_id` stays in sync with `project.organization_id`. **createTask** sets `organization_id` from the project. **Enforcement:** DB trigger keeps task and project org in sync.

- **Step 8 (code):** Shared org-data helpers in `src/app/orat/lib/org-data.ts`: `getCurrentOrganization()`, `getProjectsForOrganization(orgId)`, `createProjectForOrganization(orgId, data)`, `getTasksForProject(projectId, orgId)`. Actions delegate to these; `createProject` uses current org + `createProjectForOrganization`.

- **Migration `010_authorization_org_aware.sql`** (Step 9): RLS is organization-aware. `orat_can_access_project(proj_id, u)` now also requires `project.organization_id = orat_user_organization_id()`, so SELECT/UPDATE/DELETE on projects, members, externals, and tasks only succeed when the project is in the current user’s org. Single-org behavior unchanged.

- **Step 9 (code):** Server-side authorization checks before mutations: `ensureProjectInCurrentOrg(projectId)` and `ensureTaskInCurrentOrg(taskId)` in `org-data.ts`. Used in **updateProject**, **archiveProject**, **createTask**, **updateTask**, **updateTaskStatus**, **deleteTask**. If the resource is not in the current user’s organization, the action returns an error. This adds defense-in-depth on top of RLS.

- **Migration `011_rls_organization_ownership.sql`** (Step 10): Project INSERT and DELETE policies are organization-aware. **INSERT:** only allow rows where `owner_id = auth.uid()` and `organization_id = orat_user_organization_id()` (so new projects must belong to the current user’s org; the RPC already enforces this). **DELETE:** only allow when `owner_id = auth.uid()` and `organization_id = orat_user_organization_id()` (owner can only delete projects in their org). SELECT/UPDATE remain enforced via `orat_can_access_project` (010); tasks/members/externals unchanged.

No UI changes for org selection; project creation still uses the same dialog; the server sets `organization_id` from the user’s membership.

---

## What you need to do

### Step 4 (008): Attach projects to organizations

1. Ensure **007** has been run (one default organization exists).
2. Run **008_projects_require_organization.sql** in the SQL Editor (or `supabase db push`). It will:
   - Add all existing project owners to the default organization.
   - Set every project’s `organization_id` to that org.
   - Make `organization_id` NOT NULL and re-add the FK with ON DELETE RESTRICT.
   - Update `orat_create_project` so new projects get the current user’s org.
3. **New users** (no projects yet) are not in `organization_members`. They will get “User must belong to an organization to create a project” until you add them to the default org, e.g.:
   ```sql
   INSERT INTO public.organization_members (organization_id, user_id, role)
   SELECT (SELECT id FROM public.organizations LIMIT 1), 'USER_UUID_HERE', 'member'
   ON CONFLICT (user_id) DO NOTHING;
   ```
   A future step can add onboarding or a trigger to auto-join new users to a default org.

---

### 1. Run the migration in Supabase

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor**.
3. Open `supabase/migrations/005_organizations_additive.sql` locally and copy its full contents.
4. Paste into the SQL Editor and click **Run**.
5. Confirm there are no errors (e.g. “Success. No rows returned”).

If you use the Supabase CLI and run migrations from the project root:

```bash
supabase db push
```

(or your usual command to apply migrations to the linked project).

---

### 2. (Optional) Create one org and attach existing users/projects

Right now no rows exist in `organizations` or `organization_members`, and all projects have `organization_id = NULL`. To prepare for future org-scoped behavior without changing the app yet, you can:

**Option A – Do nothing for now**  
Leave tables empty and `organization_id` null. The app keeps working as today. You can add an “onboarding” flow later that creates an org and backfills.

**Option B – Backfill via SQL (one org per user, attach their projects)**  
Run this **once** in the SQL Editor **after** migration 005 has been applied. It:

- Creates one organization per existing project owner (named e.g. “Default” or the first project name).
- Inserts that user into `organization_members` as admin.
- Sets `orat_projects.organization_id` for their projects.

```sql
-- Run only after 005_organizations_additive.sql has been applied.
-- Creates one org per distinct project owner and links them + their projects.

do $$
declare
  r record;
  org_id uuid;
begin
  for r in select distinct p.owner_id from public.orat_projects p
  loop
    insert into public.organizations (name) values ('Default') returning id into org_id;
    insert into public.organization_members (organization_id, user_id, role)
    values (org_id, r.owner_id, 'admin')
    on conflict (user_id) do nothing;
    update public.orat_projects set organization_id = org_id where owner_id = r.owner_id;
  end loop;
end $$;
```

Note: If you have many owners, you may want to name orgs uniquely (e.g. “Default – &lt;email&gt;”). The above gives each project owner one org and attaches their projects to it.

---

### Step 9 (010): Run org-aware RLS migration

Run **010_authorization_org_aware.sql** (e.g. `supabase db push` or SQL Editor). It updates `orat_can_access_project` so that project/task access also requires the project to be in the current user’s organization. No app code change required beyond what’s already in place.

### Step 10 (011): Run organization-ownership RLS

Run **011_rls_organization_ownership.sql** (e.g. `supabase db push` or SQL Editor). It tightens project INSERT and DELETE so they require the resource to be in the current user’s organization.

---

### 3. Organization membership and single-org assumption

- **`organization_members` is required now.** It is the source of “which org is the current user in.” `orat_user_organization_id()` reads from it; RLS and app code depend on it. Migration 008 adds existing project owners to the default org so they can create projects.
- **Single-company assumption:** We use **one org per user** (unique on `organization_members.user_id`). There is no org switcher; the app behaves as one company. This is acceptable for the single-company phase. New users must be added to an org (e.g. default) to create projects—manually or via a future onboarding flow.

### 4. Future limitations of the current approach

- **Multi-org per user:** If a user is allowed to belong to multiple orgs, the current model (one row per user in `organization_members`) would need to change (e.g. remove unique on `user_id`, add “current org” context or session). RLS would need to scope by “current org” explicitly.
- **Org switcher:** The UI and `getCurrentOrganization()` assume a single org; adding a switcher would require storing selected org (e.g. session/cookie) and passing it through.
- **Cross-org project access:** Today, a user can only access projects in their (single) org. Project membership is secondary to org membership for visibility.

---

### 5. Next steps (when you’re ready)

- **Scope profiles by org**  
  When you want “only show users in my org”, filter `profiles` (or a view) by org membership using `organization_members` and `orat_user_organization_id()`.

- **Create-org RPC**  
  Add `orat_create_organization(p_name)` (SECURITY DEFINER) that creates an org and inserts the caller into `organization_members` as admin, then call it from the app (e.g. onboarding).

- **UI**  
  Keep single-company UX; no org switcher or “create org” in the main flow until you’re ready.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Run `005_organizations_additive.sql` in Supabase (SQL Editor or `supabase db push`). |
| 2 | Optional: run the backfill SQL above to create one org per owner and set `orat_projects.organization_id`. |
| 9 | Run `010_authorization_org_aware.sql` so RLS is org-aware (SQL Editor or `supabase db push`). |
| 10 | Run `011_rls_organization_ownership.sql` so project INSERT/DELETE are org-scoped (SQL Editor or `supabase db push`). |
| Later | Scope profiles by org, add create-org RPC and UI when needed. |

No env vars or app redeploy are required for Step 1.
