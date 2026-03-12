-- Step 10: Align RLS with organization ownership.
-- Project INSERT and DELETE policies now require the resource to be in the
-- current user's organization (orat_user_organization_id()).
-- SELECT/UPDATE already enforced via orat_can_access_project (010).
-- Single-company behavior unchanged: one org per user.

-- INSERT: only allow creating a project in the current user's org (RPC sets both)
drop policy if exists "Authenticated users can create projects" on public.orat_projects;
create policy "Authenticated users can create projects in own org"
  on public.orat_projects for insert
  with check (
    auth.uid() = owner_id
    and organization_id = public.orat_user_organization_id()
  );

-- DELETE: only allow deleting projects that belong to the current user's org
drop policy if exists "Project owner can delete project" on public.orat_projects;
create policy "Project owner can delete project in own org"
  on public.orat_projects for delete
  using (
    owner_id = auth.uid()
    and organization_id = public.orat_user_organization_id()
  );
