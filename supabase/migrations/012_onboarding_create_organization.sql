-- Organization onboarding: allow role 'owner' and add RPC to create org + membership.
-- Enables new users to create their first organization (no direct client INSERT policies).

-- 1. Allow role 'owner' in organization_members (creator of the org)
alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('admin', 'member', 'owner'));

-- 2. RPC: create organization and add current user as owner (atomic, SECURITY DEFINER)
create or replace function public.orat_create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_org_id uuid;
  v_slug text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- User must not already belong to an org (single-org onboarding: one org per user)
  if exists (select 1 from public.organization_members where user_id = v_uid) then
    raise exception 'User already belongs to an organization';
  end if;

  -- Slug: URL-safe, unique (use id-based to avoid collisions)
  v_slug := 'org-' || gen_random_uuid()::text;

  insert into public.organizations (name, slug)
  values (trim(nullif(p_name, '')), v_slug)
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_uid, 'owner');

  return v_org_id;
end;
$$;

comment on function public.orat_create_organization(text) is
  'Creates a new organization and adds the current user as owner. For onboarding only; user must not already belong to an org.';

grant execute on function public.orat_create_organization(text) to authenticated;
