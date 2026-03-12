-- RPC to update sort_order for multiple tasks in one call.
-- Runs with SECURITY INVOKER so RLS applies; only tasks in allowed projects are updated.

create or replace function public.orat_reorder_tasks(p_updates jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  rec jsonb;
  task_uuid uuid;
  sort_val int;
  num_updated int;
begin
  if p_updates is null or jsonb_typeof(p_updates) != 'array' then
    return jsonb_build_object('error', 'Invalid updates array');
  end if;

  for rec in select * from jsonb_array_elements(p_updates)
  loop
    begin
      -- Support both camelCase (JS) and snake_case (serialized)
      task_uuid := (coalesce(rec->>'taskId', rec->>'task_id'))::uuid;
      sort_val := (coalesce(rec->>'sortOrder', rec->>'sort_order', '0'))::int;
    exception when others then
      return jsonb_build_object('error', 'Invalid item: ' || rec::text);
    end;

    update public.orat_tasks
    set sort_order = sort_val, updated_at = now()
    where id = task_uuid;

    get diagnostics num_updated = row_count;
    if num_updated = 0 then
      return jsonb_build_object('error', 'Task not found or access denied: ' || task_uuid);
    end if;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.orat_reorder_tasks(jsonb) is
  'Updates sort_order for given tasks. RLS applies; only tasks in projects the user can access are updated.';
