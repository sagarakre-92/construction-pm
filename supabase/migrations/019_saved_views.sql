-- 019_saved_views.sql
-- Per-user saved task-list views: a snapshot of filters + grouping for a tab on the dashboard.
-- SELECT is org-wide (so a view can be shared by URL with any teammate in the same org);
-- INSERT/UPDATE/DELETE remain owner-only.

create table if not exists public.orat_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id, name)
);

comment on table public.orat_saved_views is 'Per-user saved filter snapshots for the ORAT dashboard. Shareable read-only across an organization.';
comment on column public.orat_saved_views.filters is 'Snapshot of dashboard filters: { project_id?, assignee_filter?, view_mode?, group_by?, status?, priority?, due_bucket? }.';

create index if not exists idx_orat_saved_views_user_org on public.orat_saved_views(user_id, organization_id);
create index if not exists idx_orat_saved_views_org on public.orat_saved_views(organization_id);

alter table public.orat_saved_views enable row level security;

drop policy if exists "user reads own saved views" on public.orat_saved_views;
drop policy if exists "org members read saved views" on public.orat_saved_views;
create policy "org members read saved views"
  on public.orat_saved_views for select
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

drop policy if exists "user inserts own saved views" on public.orat_saved_views;
create policy "user inserts own saved views"
  on public.orat_saved_views for insert
  with check (
    user_id = auth.uid()
    and organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

drop policy if exists "user updates own saved views" on public.orat_saved_views;
create policy "user updates own saved views"
  on public.orat_saved_views for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user deletes own saved views" on public.orat_saved_views;
create policy "user deletes own saved views"
  on public.orat_saved_views for delete
  using (user_id = auth.uid());

-- Keep updated_at fresh on row updates.
create or replace function public.orat_saved_views_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_orat_saved_views_touch on public.orat_saved_views;
create trigger trg_orat_saved_views_touch
  before update on public.orat_saved_views
  for each row execute function public.orat_saved_views_touch_updated_at();
