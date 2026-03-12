-- Add sort_order to orat_tasks for vertical order within a column (project + status).
-- Order is stable within (project_id, status); backfill by created_at, id.

alter table public.orat_tasks
  add column if not exists sort_order integer not null default 0;

-- Backfill: assign 0,1,2,... per (project_id, status) by created_at, id
with ordered as (
  select id, row_number() over (
    partition by project_id, status
    order by created_at, id
  ) as rn
  from public.orat_tasks
)
update public.orat_tasks t
set sort_order = ordered.rn - 1
from ordered
where t.id = ordered.id;

create index if not exists idx_orat_tasks_sort_order
  on public.orat_tasks(project_id, status, sort_order);

comment on column public.orat_tasks.sort_order is
  'Order within (project_id, status) for board column display. Lower = higher in column.';
