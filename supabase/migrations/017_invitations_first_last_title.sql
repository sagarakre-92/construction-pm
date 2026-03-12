-- Add first name, last name, and title to organization invitations.
-- Title is displayed on the invite form; on accept, these are applied to the user's profile.

alter table public.organization_invitations
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists title text not null default '';

comment on column public.organization_invitations.first_name is 'Invitee first name; applied to profile on accept.';
comment on column public.organization_invitations.last_name is 'Invitee last name; applied to profile on accept.';
comment on column public.organization_invitations.title is 'Invitee title (e.g. Project Manager); applied to profile.role on accept.';

-- Create invitation RPC with first_name, last_name, title; org role defaults to member.
create or replace function public.orat_create_organization_invitation(
  p_organization_id uuid,
  p_email text,
  p_first_name text default '',
  p_last_name text default '',
  p_title text default '',
  p_role text default 'member'
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
  v_role text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  v_email_trimmed := lower(trim(nullif(p_email, '')));
  if v_email_trimmed = '' then
    return jsonb_build_object('error', 'Email is required');
  end if;

  v_role := coalesce(nullif(trim(p_role), ''), 'member');
  if v_role not in ('admin', 'member') then
    v_role := 'member';
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

  if exists (
    select 1 from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_organization_id and lower(u.email) = v_email_trimmed
  ) then
    return jsonb_build_object('error', 'This user is already a member');
  end if;

  if exists (
    select 1 from public.organization_invitations
    where organization_id = p_organization_id and lower(email) = v_email_trimmed and status = 'pending'
  ) then
    return jsonb_build_object('error', 'An invitation is already pending for this email');
  end if;

  insert into public.organization_invitations (
    organization_id, email, role, invited_by,
    first_name, last_name, title
  )
  values (
    p_organization_id, v_email_trimmed, v_role, v_uid,
    coalesce(trim(p_first_name), ''),
    coalesce(trim(p_last_name), ''),
    coalesce(trim(p_title), '')
  )
  returning id, token into v_invite_id, v_token;

  return jsonb_build_object('id', v_invite_id, 'token', v_token);
end;
$$;

grant execute on function public.orat_create_organization_invitation(uuid, text, text, text, text, text) to authenticated;

-- Update accept RPC to apply invitee first_name, last_name, title to user profile on accept.
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

  select id, organization_id, email, role, status, expires_at, first_name, last_name, title
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

  if exists (
    select 1 from public.organization_members
    where organization_id = v_invite.organization_id and user_id = v_uid
  ) then
    update public.organization_invitations set status = 'accepted', accepted_at = now() where id = v_invite.id;
    return jsonb_build_object('ok', true, 'message', 'Already a member');
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_invite.organization_id, v_uid, v_invite.role);

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

  return jsonb_build_object('ok', true);
end;
$$;
