-- Fix infinite recursion: policies on orat_project_members queried orat_projects,
-- and orat_projects policies queried orat_project_members. Use a SECURITY DEFINER
-- function to check project access without invoking RLS.

create or replace function public.orat_can_access_project(proj_id uuid, u uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.orat_projects p
    where p.id = proj_id and p.owner_id = u
  )
  or exists (
    select 1 from public.orat_project_members m
    where m.project_id = proj_id and m.user_id = u
  );
$$;

-- Drop recursive policies
drop policy if exists "Users can view projects they own or are member of" on public.orat_projects;
drop policy if exists "Project owner or member can update project" on public.orat_projects;
drop policy if exists "Users can view project members for their projects" on public.orat_project_members;
drop policy if exists "Project owner or member can manage project members" on public.orat_project_members;
drop policy if exists "Users can manage external stakeholders for their projects" on public.orat_external_stakeholders;
drop policy if exists "Users can manage tasks for their projects" on public.orat_tasks;

-- Recreate policies using the function (no cross-table RLS recursion)
create policy "Users can view projects they own or are member of"
  on public.orat_projects for select
  using (public.orat_can_access_project(id, auth.uid()));

create policy "Project owner or member can update project"
  on public.orat_projects for update
  using (public.orat_can_access_project(id, auth.uid()));

create policy "Users can view project members for their projects"
  on public.orat_project_members for select
  using (public.orat_can_access_project(project_id, auth.uid()));

-- WITH CHECK allows INSERT: owner can add members right after creating the project
create policy "Project owner or member can manage project members"
  on public.orat_project_members for all
  using (public.orat_can_access_project(project_id, auth.uid()))
  with check (public.orat_can_access_project(project_id, auth.uid()));

create policy "Users can manage external stakeholders for their projects"
  on public.orat_external_stakeholders for all
  using (public.orat_can_access_project(project_id, auth.uid()));

create policy "Users can manage tasks for their projects"
  on public.orat_tasks for all
  using (public.orat_can_access_project(project_id, auth.uid()));
