-- Preview invitation by token (no auth required; token is the secret).
-- Enforce invitee email + single-org rules on accept for org-wide and project-scoped invites.

------------------------------------------------------------------------------
-- 1. Preview RPC (callable as anon for server-side invite landing pages)
------------------------------------------------------------------------------

create or replace function public.orat_preview_organization_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object('error', 'Invalid invitation link');
  end if;

  select
    i.id,
    i.organization_id,
    i.email,
    i.role,
    i.status,
    i.expires_at,
    i.project_id,
    o.name as organization_name,
    p.name as project_name
  into r
  from public.organization_invitations i
  join public.organizations o on o.id = i.organization_id
  left join public.orat_projects p on p.id = i.project_id
  where i.token = trim(p_token)
  limit 1;

  if r.id is null then
    return jsonb_build_object('error', 'Invitation not found');
  end if;

  if r.status <> 'pending' then
    return jsonb_build_object('error', 'This invitation is no longer valid');
  end if;

  if r.expires_at < now() then
    update public.organization_invitations set status = 'expired' where id = r.id;
    return jsonb_build_object('error', 'This invitation has expired');
  end if;

  return jsonb_build_object(
    'ok', true,
    'organization_id', r.organization_id,
    'organization_name', r.organization_name,
    'invited_email', r.email,
    'invited_role', r.role,
    'expires_at', r.expires_at,
    'project_id', r.project_id,
    'project_name', coalesce(r.project_name, '')
  );
end;
$$;

comment on function public.orat_preview_organization_invitation(text) is
  'Returns non-secret summary for a valid pending invite token. No auth required.';

grant execute on function public.orat_preview_organization_invitation(text) to anon;
grant execute on function public.orat_preview_organization_invitation(text) to authenticated;

------------------------------------------------------------------------------
-- 2. Org-wide accept: email match + block second organization
------------------------------------------------------------------------------

create or replace function public.orat_accept_organization_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid;
  v_invite record;
  v_user_email text;
  v_existing_org uuid;
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
  if v_invite.status <> 'pending' then
    return jsonb_build_object('error', 'This invitation has already been used or cancelled');
  end if;
  if v_invite.expires_at < now() then
    update public.organization_invitations set status = 'expired' where id = v_invite.id;
    return jsonb_build_object('error', 'This invitation has expired');
  end if;

  select lower(trim(coalesce(u.email, ''))) into v_user_email
  from auth.users u
  where u.id = v_uid
  limit 1;

  if v_user_email = '' then
    return jsonb_build_object('error', 'Your account does not have an email address on file.');
  end if;

  if v_user_email <> lower(trim(v_invite.email)) then
    return jsonb_build_object(
      'error',
      'This invitation was sent to a different email address. Sign in with the invited email or ask for a new invitation.'
    );
  end if;

  select organization_id into v_existing_org
  from public.organization_members
  where user_id = v_uid
  limit 1;

  if v_existing_org is not null and v_existing_org is distinct from v_invite.organization_id then
    return jsonb_build_object(
      'error',
      'You already belong to another organization. Leave that organization before accepting this invitation.'
    );
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

------------------------------------------------------------------------------
-- 3. Project-scoped accept: same email + same-org / not-in-other-org rules
------------------------------------------------------------------------------

create or replace function public.orat_accept_project_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_invite record;
  v_user_email text;
  v_existing_org uuid;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object('error', 'Invalid invitation link');
  end if;

  select id, organization_id, project_id, project_role, status, expires_at,
         first_name, last_name, title, email
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

  select lower(trim(coalesce(u.email, ''))) into v_user_email
  from auth.users u
  where u.id = v_uid
  limit 1;

  if v_user_email = '' then
    return jsonb_build_object('error', 'Your account does not have an email address on file.');
  end if;

  if v_user_email <> lower(trim(v_invite.email)) then
    return jsonb_build_object(
      'error',
      'This invitation was sent to a different email address. Sign in with the invited email or ask for a new invitation.'
    );
  end if;

  select organization_id into v_existing_org
  from public.organization_members
  where user_id = v_uid
  limit 1;

  if v_existing_org is not null and v_existing_org is distinct from v_invite.organization_id then
    return jsonb_build_object(
      'error',
      'You already belong to another organization. Leave that organization before accepting this invitation.'
    );
  end if;

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
