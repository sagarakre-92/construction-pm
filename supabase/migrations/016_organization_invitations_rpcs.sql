-- RPCs and helper for organization invitations.
-- orat_create_organization_invitation: only owners/admins; creates pending invite with unique token.
-- orat_accept_organization_invitation: validates token, adds user to org, marks invite accepted (one-time use).
-- orat_user_org_role: returns current user's role in their org (for UI: show invite only to owner/admin).

-- Role of current user in their organization (null if no org or not member)
create or replace function public.orat_user_org_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.organization_members where user_id = auth.uid() limit 1;
$$;

-- Create invitation: current user must be owner or admin of the org.
create or replace function public.orat_create_organization_invitation(
  p_organization_id uuid,
  p_email text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid;
  v_user_role text;
  v_invite_id uuid;
  v_token text;
  v_email_trimmed text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  v_email_trimmed := lower(trim(nullif(p_email, '')));
  if v_email_trimmed = '' then
    return jsonb_build_object('error', 'Email is required');
  end if;

  if p_role is null or p_role not in ('admin', 'member') then
    return jsonb_build_object('error', 'Role must be admin or member');
  end if;

  select role into v_user_role
  from public.organization_members
  where organization_id = p_organization_id and user_id = v_uid
  limit 1;

  if v_user_role is null then
    return jsonb_build_object('error', 'You are not a member of this organization');
  end if;
  if v_user_role not in ('owner', 'admin') then
    return jsonb_build_object('error', 'Only owners and admins can invite members');
  end if;

  -- Prevent inviting existing member (by email; requires auth in search_path)
  if exists (
    select 1 from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_organization_id and lower(u.email) = v_email_trimmed
  ) then
    return jsonb_build_object('error', 'This user is already a member');
  end if;

  -- Prevent duplicate pending invite
  if exists (
    select 1 from public.organization_invitations
    where organization_id = p_organization_id and lower(email) = v_email_trimmed and status = 'pending'
  ) then
    return jsonb_build_object('error', 'An invitation is already pending for this email');
  end if;

  insert into public.organization_invitations (organization_id, email, role, invited_by)
  values (p_organization_id, v_email_trimmed, p_role, v_uid)
  returning id, token into v_invite_id, v_token;

  return jsonb_build_object('id', v_invite_id, 'token', v_token);
end;
$$;

-- Accept invitation: validate token, add current user to org, mark invite accepted.
create or replace function public.orat_accept_organization_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_invite record;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object('error', 'Invalid invitation link');
  end if;

  select id, organization_id, email, role, status, expires_at
  into v_invite
  from public.organization_invitations
  where token = trim(p_token)
  limit 1;

  if v_invite.id is null then
    return jsonb_build_object('error', 'Invitation not found');
  end if;
  if v_invite.status != 'pending' then
    return jsonb_build_object('error', 'This invitation has already been used or cancelled');
  end if;
  if v_invite.expires_at < now() then
    update public.organization_invitations set status = 'expired' where id = v_invite.id;
    return jsonb_build_object('error', 'This invitation has expired');
  end if;

  -- User already in org?
  if exists (
    select 1 from public.organization_members
    where organization_id = v_invite.organization_id and user_id = v_uid
  ) then
    update public.organization_invitations set status = 'accepted', accepted_at = now() where id = v_invite.id;
    return jsonb_build_object('ok', true, 'message', 'Already a member');
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_invite.organization_id, v_uid, v_invite.role);

  update public.organization_invitations
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.orat_user_org_role() to authenticated;
grant execute on function public.orat_create_organization_invitation(uuid, text, text) to authenticated;
grant execute on function public.orat_accept_organization_invitation(text) to authenticated;
