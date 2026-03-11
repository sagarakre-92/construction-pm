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

### 3. Next steps (when you’re ready)

- **Use `organization_id` in RLS**  
  Add conditions so project/task access can be “user is in the project’s org” (e.g. using `orat_user_organization_id()`), while keeping “owner or project member” as fallback so existing behavior stays.

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
| 3 | Later: add RLS using `orat_user_organization_id()`, scope profiles, add create-org RPC and UI when needed. |

No env vars or app redeploy are required for Step 1.
