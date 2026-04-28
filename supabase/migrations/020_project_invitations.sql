-- 020_project_invitations.sql
-- Extend organization_invitations with optional project scoping (project_id + project_role)
-- and add a per-project role to orat_project_members so we can gate edit vs read in the UI.
--
-- Trade-off (pragmatic path): a project-scoped acceptance ALSO inserts a row into
-- organization_members with role='member' so the user shows up under existing
-- org-membership-based RLS for orat_projects/orat_tasks. The project_role column
-- on orat_project_members is what gates EDIT capability at the application layer.
-- A "true external collaborator" model (no org_members row, with new RLS that allows
-- access via orat_project_members alone) is a P1 follow-up.

------------------------------------------------------------------------------
-- 1. Extend organization_invitations with project scoping
------------------------------------------------------------------------------

alter table public.organization_invitations
  add column if not exists project_id uuid references public.orat_projects(id) on delete cascade;

alter table public.organization_invitations
  add column if not exists project_role text
  check (project_role in ('editor', 'viewer'));

create index if not exists idx_org_invitations_project
  on public.organization_invitations(project_id) where project_id is not null;

-- The original "one pending invite per (org, lower(email))" unique index would prevent
-- a person being invited to multiple distinct projects in the same org at once. Replace
-- it with a composite that includes project_id (treating the org-wide scope as project_id IS NULL).
drop index if exists public.idx_organization_invitations_pending_unique;
create unique index if not exists idx_organization_invitations_pending_unique
  on public.organization_invitations (organization_id, lower(email), coalesce(project_id::text, ''))
  where status = 'pending';

------------------------------------------------------------------------------
-- 2. Per-project role on orat_project_members
------------------------------------------------------------------------------

alter table public.orat_project_members
  add column if not exists project_role text not null default 'editor'
  check (project_role in ('editor', 'viewer'));

comment on column public.orat_project_members.project_role is
  'Per-project role: editor (modify) | viewer (read-only). Gates UI capabilities.';

------------------------------------------------------------------------------
-- 3. RPC: orat_create_project_invitation
------------------------------------------------------------------------------
-- Caller must be owner/admin of the org OR an editor on this project.
-- Inserts a project-scoped pending invitation (project_id and project_role set).
-- Re-uses organization_invitations defaults for token (text, hex-encoded) and expires_at.

create or replace function public.orat_create_project_invitation(
  p_project_id uuid,
  p_email text,
  p_first_name text default '',
  p_last_name text default '',
  p_title text default '',
  p_project_role text default 'editor'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_caller_role text;
  v_is_project_editor boolean;
  v_email_trimmed text;
  v_role text;
  v_invite_id uuid;
  v_token text;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  v_email_trimmed := lower(trim(nullif(p_email, '')));
  if v_email_trimmed = '' then
    return jsonb_build_object('error', 'Email is required');
  end if;

  v_role := coalesce(nullif(trim(p_project_role), ''), 'editor');
  if v_role not in ('editor', 'viewer') then
    return jsonb_build_object('error', 'Project role must be editor or viewer');
  end if;

  select organization_id into v_org_id
  from public.orat_projects
  where id = p_project_id;
  if v_org_id is null then
    return jsonb_build_object('error', 'Project not found');
  end if;

  select role into v_caller_role
  from public.organization_members
  where organization_id = v_org_id and user_id = v_uid
  limit 1;

  select exists (
    select 1 from public.orat_project_members
    where project_id = p_project_id
      and user_id = v_uid
      and project_role = 'editor'
  ) into v_is_project_editor;

  if v_caller_role not in ('owner', 'admin') and not v_is_project_editor then
    return jsonb_build_object('error', 'Not authorized to invite to this project');
  end if;

  -- Block invite for someone already in the org AND already on this project.
  if exists (
    select 1
    from public.organization_members m
    join auth.users u on u.id = m.user_id
    join public.orat_project_members pm on pm.user_id = m.user_id and pm.project_id = p_project_id
    where m.organization_id = v_org_id and lower(u.email) = v_email_trimmed
  ) then
    return jsonb_build_object('error', 'This user is already a member of this project');
  end if;

  -- Block duplicate pending invite for the same (org, email, project).
  if exists (
    select 1 from public.organization_invitations
    where organization_id = v_org_id
      and lower(email) = v_email_trimmed
      and project_id = p_project_id
      and status = 'pending'
  ) then
    return jsonb_build_object('error', 'An invitation is already pending for this email on this project');
  end if;

  insert into public.organization_invitations (
    organization_id, email, role, invited_by,
    first_name, last_name, title,
    project_id, project_role,
    expires_at
  )
  values (
    v_org_id, v_email_trimmed, 'member', v_uid,
    coalesce(trim(p_first_name), ''),
    coalesce(trim(p_last_name), ''),
    coalesce(trim(p_title), ''),
    p_project_id, v_role,
    now() + interval '14 days'
  )
  returning id, token into v_invite_id, v_token;

  return jsonb_build_object('id', v_invite_id, 'token', v_token);
end;
$$;

grant execute on function public.orat_create_project_invitation(uuid, text, text, text, text, text) to authenticated;

------------------------------------------------------------------------------
-- 4. RPC: orat_accept_project_invitation
------------------------------------------------------------------------------
-- Validates token, then for project-scoped invitations:
--   - inserts into orat_project_members with the invited project_role
--   - ALSO inserts into organization_members with role='member' (pragmatic path
--     so existing org-scoped RLS keeps working).
--   - applies invitee profile fields if missing
--   - marks the invitation accepted (one-time use)
-- For org-wide invitations (project_id is null) returns an error so callers fall
-- back to orat_accept_organization_invitation.

create or replace function public.orat_accept_project_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_invite record;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object('error', 'Invalid invitation link');
  end if;

  select id, organization_id, project_id, project_role, status, expires_at,
         first_name, last_name, title
  into v_invite
  from public.organization_invitations
  where token = trim(p_token)
  limit 1;

  if v_invite.id is null then
    return jsonb_build_object('error', 'Invitation not found');
  end if;
  if v_invite.project_id is null then
    return jsonb_build_object('error', 'Not a project-scoped invitation');
  end if;
  if v_invite.status <> 'pending' then
    return jsonb_build_object('error', 'This invitation has already been used or cancelled');
  end if;
  if v_invite.expires_at < now() then
    update public.organization_invitations set status = 'expired' where id = v_invite.id;
    return jsonb_build_object('error', 'This invitation has expired');
  end if;

  -- Pragmatic path: ensure the user is in organization_members so existing
  -- org-scoped RLS continues to work for them.
  insert into public.organization_members (organization_id, user_id, role)
  values (v_invite.organization_id, v_uid, 'member')
  on conflict (user_id) do nothing;

  insert into public.orat_project_members (project_id, user_id, project_role)
  values (v_invite.project_id, v_uid, coalesce(v_invite.project_role, 'editor'))
  on conflict (project_id, user_id) do update
    set project_role = excluded.project_role;

  insert into public.profiles (id, first_name, last_name, role, company, created_at, updated_at)
  values (
    v_uid,
    coalesce(trim(v_invite.first_name), ''),
    coalesce(trim(v_invite.last_name), ''),
    coalesce(trim(v_invite.title), ''),
    '',
    now(),
    now()
  )
  on conflict (id) do update set
    first_name = coalesce(nullif(trim(v_invite.first_name), ''), profiles.first_name),
    last_name = coalesce(nullif(trim(v_invite.last_name), ''), profiles.last_name),
    role = coalesce(nullif(trim(v_invite.title), ''), profiles.role),
    updated_at = now();

  update public.organization_invitations
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id;

  return jsonb_build_object(
    'ok', true,
    'project_id', v_invite.project_id,
    'organization_id', v_invite.organization_id
  );
end;
$$;

grant execute on function public.orat_accept_project_invitation(text) to authenticated;

------------------------------------------------------------------------------
-- 5. RPC: orat_user_project_role
------------------------------------------------------------------------------
-- Returns the current user's effective role on a project for UI gating:
--   'owner' / 'admin' / 'editor' / 'viewer' / null
-- Org owner/admin override; otherwise we use orat_project_members.project_role.

create or replace function public.orat_user_project_role(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_org_role text;
  v_proj_role text;
begin
  if v_uid is null then
    return null;
  end if;

  select organization_id into v_org_id
  from public.orat_projects
  where id = p_project_id;
  if v_org_id is null then
    return null;
  end if;

  select role into v_org_role
  from public.organization_members
  where organization_id = v_org_id and user_id = v_uid
  limit 1;

  if v_org_role in ('owner', 'admin') then
    return v_org_role;
  end if;

  select project_role into v_proj_role
  from public.orat_project_members
  where project_id = p_project_id and user_id = v_uid
  limit 1;

  return v_proj_role;
end;
$$;

grant execute on function public.orat_user_project_role(uuid) to authenticated;
