-- 018_add_task_priority.sql
-- Adds a priority field to orat_tasks (high|medium|low). Default is 'medium'.

alter table public.orat_tasks
  add column if not exists priority text not null default 'medium'
  check (priority in ('high', 'medium', 'low'));

create index if not exists idx_orat_tasks_org_priority
  on public.orat_tasks(organization_id, priority);

comment on column public.orat_tasks.priority is 'Task priority: high | medium | low. Default medium.';
