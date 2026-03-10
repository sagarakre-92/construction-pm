-- Create project via RPC so insert succeeds when auth.uid() is not set on direct insert
-- (e.g. server-side client). Function runs as definer and uses JWT claim for owner_id.

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
  v_id uuid;
begin
  -- Get caller from JWT (set by PostgREST when using anon + Bearer token)
  v_uid := coalesce(
    (current_setting('request.jwt.claim.sub', true))::uuid,
    auth.uid()
  );
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.orat_projects (name, description, owner_id)
  values (p_name, coalesce(p_description, ''), v_uid)
  returning id into v_id;

  insert into public.orat_project_members (project_id, user_id)
  values (v_id, v_uid);

  return v_id;
end;
$$;

comment on function public.orat_create_project(text, text) is
  'Creates a project and adds the authenticated user as owner and member. Call via supabase.rpc.';

grant execute on function public.orat_create_project(text, text) to authenticated;
grant execute on function public.orat_create_project(text, text) to service_role;
