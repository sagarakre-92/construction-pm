-- Step 9: Align RLS with organization-aware structure.
-- orat_can_access_project now requires the project to be in the current user's
-- organization (orat_user_organization_id()). Single-org behavior unchanged.

create or replace function public.orat_can_access_project(proj_id uuid, u uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.orat_projects p
    where p.id = proj_id
      and p.owner_id = u
      and p.organization_id = public.orat_user_organization_id()
  )
  or exists (
    select 1 from public.orat_project_members m
    join public.orat_projects p on p.id = m.project_id
    where m.project_id = proj_id and m.user_id = u
      and p.organization_id = public.orat_user_organization_id()
  );
$$;
