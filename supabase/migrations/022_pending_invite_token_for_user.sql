-- Return the latest pending organization-invitation token for the current user's
-- auth email when they are not yet in any organization. Used to redirect /orat
-- and /onboarding to /invite/{token} so invitees never hit "create organization".

create or replace function public.orat_get_pending_organization_invite_token_for_user()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid;
  v_email text;
  v_token text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  select lower(trim(coalesce(u.email, ''))) into v_email
  from auth.users u
  where u.id = v_uid
  limit 1;

  if v_email = '' then
    return jsonb_build_object('ok', true, 'token', null::text);
  end if;

  if exists (
    select 1 from public.organization_members om where om.user_id = v_uid limit 1
  ) then
    return jsonb_build_object('ok', true, 'token', null::text);
  end if;

  select i.token into v_token
  from public.organization_invitations i
  where lower(trim(i.email)) = v_email
    and i.status = 'pending'
    and i.expires_at >= now()
  order by i.created_at desc
  limit 1;

  return jsonb_build_object('ok', true, 'token', v_token);
end;
$$;

comment on function public.orat_get_pending_organization_invite_token_for_user() is
  'Newest pending org invite token for auth email when user has no organization_members row; else token null.';

grant execute on function public.orat_get_pending_organization_invite_token_for_user() to authenticated;
grant execute on function public.orat_get_pending_organization_invite_token_for_user() to service_role;
