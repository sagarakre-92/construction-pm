-- Step 4: Attach projects to organizations.
-- 1) Add existing project owners to the default org so they can create projects.
-- 2) Backfill existing projects to the default organization.
-- 3) Make organization_id NOT NULL and FK ON DELETE RESTRICT.
-- 4) Update orat_create_project to set organization_id from current user's org.

-- Ensure at least one organization exists (007 seed)
do $$
begin
  if not exists (select 1 from public.organizations limit 1) then
    raise exception 'Run migration 007_seed_default_organization.sql first so a default organization exists.';
  end if;
end $$;

-- 1) Add every existing project owner to the default organization (so orat_user_organization_id() works for them)
insert into public.organization_members (organization_id, user_id, role)
select (select id from public.organizations order by created_at asc limit 1), o.owner_id, 'admin'
from (select distinct owner_id from public.orat_projects) o
on conflict (user_id) do nothing;

-- 2) Backfill: attach all projects without organization_id to the default org
update public.orat_projects
set organization_id = (select id from public.organizations order by created_at asc limit 1)
where organization_id is null;

-- 3a) Drop existing FK (was ON DELETE SET NULL; we need NOT NULL column so use RESTRICT)
-- If this fails, check constraint name: SELECT conname FROM pg_constraint WHERE conrelid = 'public.orat_projects'::regclass AND contype = 'f';
alter table public.orat_projects
  drop constraint if exists orat_projects_organization_id_fkey;

-- 3b) Enforce NOT NULL
alter table public.orat_projects
  alter column organization_id set not null;

-- 3c) Re-add FK with ON DELETE RESTRICT (cannot delete an org that has projects)
alter table public.orat_projects
  add constraint orat_projects_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict;

-- Index already exists from 005 (idx_orat_projects_organization_id)

-- 4) Update RPC: new projects get organization_id from current user's org
create or replace function public.orat_create_project(
  p_name text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_org_id uuid;
  v_id uuid;
begin
  v_uid := coalesce(
    (current_setting('request.jwt.claim.sub', true))::uuid,
    auth.uid()
  );
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_org_id := public.orat_user_organization_id();
  if v_org_id is null then
    raise exception 'User must belong to an organization to create a project.';
  end if;

  insert into public.orat_projects (name, description, owner_id, organization_id)
  values (p_name, coalesce(p_description, ''), v_uid, v_org_id)
  returning id into v_id;

  insert into public.orat_project_members (project_id, user_id)
  values (v_id, v_uid);

  return v_id;
end;
$$;

comment on function public.orat_create_project(text, text) is
  'Creates a project in the current user''s organization and adds the user as owner and member.';
