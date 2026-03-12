# Step 2 & Step 11 – Summary (Already Implemented)

Both steps are already implemented in this codebase. This doc summarizes what exists and where future org switching would plug in.

---

## Step 2: First-class organization model (database only)

### Migration SQL

The organizations table and slug are defined across two migrations:

**`005_organizations_additive.sql`** – organizations table + membership (needed for “current org” resolution):

```sql
-- Organizations table: UUID PK, name, created_at, updated_at
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- organization_members included so orat_user_organization_id() can resolve current org
create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  unique (user_id)
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
-- ... policies and orat_user_organization_id() ...
```

**`006_organizations_slug.sql`** – slug column (unique, not null):

```sql
alter table public.organizations add column if not exists slug text;
-- backfill, then:
alter table public.organizations alter column slug set not null;
create unique index if not exists idx_organizations_slug on public.organizations(slug);
```

`updated_at` is maintained by the `organizations_updated_at` trigger in 005 (using `set_updated_at` from 001).

### RLS policies added

| Table                 | Policy                         | Effect                                      |
|-----------------------|--------------------------------|--------------------------------------------|
| `organizations`       | "Users can view own organization" | SELECT only where user is in `organization_members` for that org |
| `organization_members` | "Users can view own membership"   | SELECT only where `user_id = auth.uid()`   |

No INSERT/UPDATE/DELETE policies on these tables from the client; creation is done via RPC/backend (e.g. 007 seed, 008 backfill).

### Assumptions

- **organization_members exists** so “current org” can be resolved via `orat_user_organization_id()` (used by RLS and app). Step 2’s “do not add membership unless necessary” is satisfied because it is necessary for current-org resolution.
- One org per user (unique on `organization_members.user_id`) for the single-company phase.

### Next step after Step 2

After 005+006, the next steps were: seed default org (007), attach projects to orgs (008), then tasks (009), then RLS/auth (010, 011).

---

## Step 11: Lightweight current-organization concept in application code

### How current organization is resolved

1. **Single source of truth (server):**  
   `getCurrentOrganization()` in `src/app/orat/lib/org-data.ts`:
   - Ensures the user is authenticated.
   - Calls Supabase RPC `orat_user_organization_id()` (reads `organization_members` for the current user; returns one `organization_id`).
   - Loads that org’s row from `organizations` (`id`, `name`, `slug`) and returns it as `{ id, name, slug }`.
   - Returns `{ data: null }` if the user has no org or is unauthenticated.

2. **Where it’s used:**
   - **Project list:** `getProjectsWithDetails()` (in `actions.ts`) calls `getCurrentOrganization()` then `getProjectsForOrganization(org.id)` so the UI only gets projects for the current org.
   - **Project creation:** `createProject()` calls `getCurrentOrganization()` then `createProjectForOrganization(org.id, data)` so new projects are created in the current org.
   - **Mutations:** `ensureProjectInCurrentOrg(projectId)` and `ensureTaskInCurrentOrg(taskId)` (in `org-data.ts`) use `getCurrentOrganization()` to ensure the resource’s org matches the current user’s org before allowing updates/deletes.

The UI does **not** call `getCurrentOrganization()` directly and does not show org name or an org switcher; it only uses org-scoped data via the above actions.

### Files involved

| File | Role |
|------|------|
| `src/app/orat/lib/org-data.ts` | Defines `getCurrentOrganization()`, `getProjectsForOrganization(orgId)`, `createProjectForOrganization(orgId, data)`, `getTasksForProject(projectId, orgId)`, `ensureProjectInCurrentOrg`, `ensureTaskInCurrentOrg`. |
| `src/app/orat/actions.ts` | Re-exposes getCurrentOrganization / getProjectsForOrganization / getTasksForProject for server use; `getProjectsWithDetails()` and `createProject()` call into org-data and use current org. |
| `src/app/orat/page.tsx` | Uses only `getProjectsWithDetails`, `createProjectAction`, and other actions; never resolves org itself. |

### Where future org switching would plug in

- **Today:** “Current org” = the one row in `organization_members` for the current user (single-org).
- **Multi-org / switcher later:**
  - **Option A (session/cookie):** Store the selected org id in session or a cookie. Add a small layer (e.g. `getCurrentOrganizationId()` or a wrapper around `getCurrentOrganization()`) that:
    - Prefers the session/cookie org id when present and valid for the user.
    - Falls back to `orat_user_organization_id()` when no selection exists.
  - **Option B (parameter):** Pass an optional `organizationId` into `getProjectsWithDetails`, `createProjectForOrganization`, and list/mutation helpers; when provided, use it instead of calling `orat_user_organization_id()`. The UI would then pass the selected org from a switcher.
  - In both cases, keep using the same helpers (`getProjectsForOrganization(orgId)`, `createProjectForOrganization(orgId, data)`, and the same RLS); only the **resolution** of “which org id to use” changes (DB-only today → session or UI-selected later).

No multi-org switcher UI exists yet; the implementation is ready to extend by changing how the “current” org id is chosen before calling the existing org-scoped functions.
