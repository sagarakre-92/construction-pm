---
name: add-supabase-migration
description: Add a Supabase Postgres migration to ORAT (schema change, new table, new RPC, or RLS update). Use whenever the user asks to add a column, table, RPC, policy, function, alter the database, or change RLS in the construction-pm / ORAT project.
---

# Add a Supabase migration

Use this when changing the database schema, adding/altering a table, writing
a new `security definer` RPC, or adjusting Row Level Security policies in the
ORAT project.

## Workflow

```
- [ ] 1. Determine the next migration number
- [ ] 2. Create supabase/migrations/NNN_short_name.sql
- [ ] 3. Write idempotent SQL (DDL + RLS + RPC if needed)
- [ ] 4. If you added a new table, add 4 RLS policies (select/insert/update/delete)
- [ ] 5. Apply the migration in the user's Supabase SQL editor
- [ ] 6. Update affected TypeScript types in src/app/orat/types.ts
- [ ] 7. Extend src/app/orat/lib/org-data.ts if reads/writes need new helpers
- [ ] 8. Add a Vitest test for any new org-data helper (mirror org-data.test.ts)
```

## Step 1 — Next number

```bash
ls supabase/migrations/ | sort | tail -n 5
```

Pick the next `NNN` (zero-padded to 3 digits). Name format:
`NNN_short_snake_case.sql`. Example: `018_add_task_priority.sql`.

## Step 2 — Idempotent DDL

Always use `if not exists` / `or replace` so re-running the file is safe in
dev. Top of every migration:

```sql
-- 018_add_task_priority.sql
-- Adds a `priority` column to orat_tasks (low/normal/high).

alter table public.orat_tasks
  add column if not exists priority text not null default 'normal'
  check (priority in ('low', 'normal', 'high'));

comment on column public.orat_tasks.priority is 'Task priority: low | normal | high.';
```

## Step 3 — RLS for new tables

Every new table MUST have RLS enabled and explicit policies. Copy this
template — it mirrors the org-membership pattern used across the project:

```sql
create table if not exists public.orat_my_thing (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- … your columns …
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orat_my_thing_org on public.orat_my_thing(organization_id);

alter table public.orat_my_thing enable row level security;

drop policy if exists "members read orat_my_thing" on public.orat_my_thing;
create policy "members read orat_my_thing"
  on public.orat_my_thing for select
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

drop policy if exists "members insert orat_my_thing" on public.orat_my_thing;
create policy "members insert orat_my_thing"
  on public.orat_my_thing for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

drop policy if exists "members update orat_my_thing" on public.orat_my_thing;
create policy "members update orat_my_thing"
  on public.orat_my_thing for update
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

drop policy if exists "admins delete orat_my_thing" on public.orat_my_thing;
create policy "admins delete orat_my_thing"
  on public.orat_my_thing for delete
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );
```

## Step 4 — RPCs (if needed)

Use the canonical shape from migration `017`:

```sql
create or replace function public.orat_do_thing(p_org_id uuid, p_value text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = v_uid
  ) then
    return jsonb_build_object('error', 'Not a member of this organization');
  end if;

  -- … work here …

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.orat_do_thing(uuid, text) to authenticated;
```

## Step 5 — Apply the migration

The user runs this in Supabase manually (no auto-apply pipeline yet):

1. Open Supabase dashboard → SQL editor.
2. Paste the contents of the new migration file.
3. Run it. Verify "Success" + spot-check the affected tables in Table editor.

If a Supabase CLI is wired (`supabase` binary present):

```bash
supabase db push
```

## Step 6 — Sync TypeScript types

Add/extend the relevant type in `src/app/orat/types.ts`. Don't invent shapes
inside components — types are the contract.

## Step 7 — Extend the data layer

If app code needs to read/write the new column or table, add a helper in
`src/app/orat/lib/org-data.ts`. Don't query `from("orat_my_thing")` from a
component or action.

## Step 8 — Test

Add a unit test in `src/app/orat/lib/org-data.test.ts` (or a sibling file)
that mocks Supabase and asserts the new helper:
- includes the `organization_id` filter on reads, AND
- sets the `organization_id` from the current org on writes.

## Anti-patterns

- ❌ Editing an old migration file. Migrations are immutable history.
- ❌ Adding a table without RLS, or with only `select` policy.
- ❌ Trusting a caller-supplied `organization_id` in an RPC without checking
  membership.
- ❌ Forgetting `grant execute … to authenticated` on a new RPC.
- ❌ Non-idempotent DDL (`create table` without `if not exists`).
