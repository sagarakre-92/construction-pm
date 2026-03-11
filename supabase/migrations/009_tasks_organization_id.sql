-- Step 6: Make tasks organization-aware.
-- Add organization_id, backfill from parent project, NOT NULL, FK, index.
-- Trigger keeps task.organization_id in sync with project.organization_id (PostgreSQL CHECK cannot use subqueries).

-- 1) Add column (nullable for backfill)
alter table public.orat_tasks
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

-- 2) Backfill from parent project
update public.orat_tasks t
set organization_id = p.organization_id
from public.orat_projects p
where t.project_id = p.id and t.organization_id is null;

-- 3) NOT NULL
alter table public.orat_tasks
  alter column organization_id set not null;

-- 4) Index for org-scoped task queries
create index if not exists idx_orat_tasks_organization_id
  on public.orat_tasks(organization_id);

-- 5) Trigger: set organization_id from project (ensures consistency; replaces CHECK with subquery)
create or replace function public.orat_tasks_sync_organization_id()
returns trigger
language plpgsql
as $$
begin
  select p.organization_id into new.organization_id
  from public.orat_projects p
  where p.id = new.project_id;
  if new.organization_id is null then
    raise exception 'Project % has no organization_id', new.project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists orat_tasks_sync_organization_id_trigger on public.orat_tasks;
create trigger orat_tasks_sync_organization_id_trigger
  before insert or update of project_id, organization_id
  on public.orat_tasks
  for each row execute function public.orat_tasks_sync_organization_id();

comment on column public.orat_tasks.organization_id is
  'Organization that owns the task; synced from project via trigger.';
