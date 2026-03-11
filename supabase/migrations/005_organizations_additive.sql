-- Additive migration: organizations and org membership.
-- No existing RLS or queries are changed. Projects get optional organization_id.
-- One org per user (organization_members.user_id unique) for future single-company behavior.

-- 1. Create both tables first (policies reference organization_members, so it must exist)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  unique (user_id)
);

-- 2. Enable RLS and add policies
alter table public.organizations enable row level security;

alter table public.organization_members enable row level security;

-- Users can view organizations they belong to (for future use)
create policy "Users can view own organization"
  on public.organizations for select
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organizations.id and m.user_id = auth.uid()
    )
  );

-- Users can view their own membership row
create policy "Users can view own membership"
  on public.organization_members for select
  using (user_id = auth.uid());

-- INSERT for organizations / organization_members: use a future RPC (e.g. orat_create_organization)
-- so creation is atomic and controlled. No direct client INSERT policies added here.

-- Add optional organization_id to projects (nullable; existing rows stay null)
alter table public.orat_projects
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

-- Index for future org-scoped project queries
create index if not exists idx_orat_projects_organization_id
  on public.orat_projects(organization_id);

-- Trigger for organizations.updated_at (uses set_updated_at from 001)
create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- Helper: return the current user's organization_id (for future RLS or app code). SECURITY DEFINER so it can read organization_members.
create or replace function public.orat_user_organization_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.organization_members where user_id = auth.uid() limit 1;
$$;

comment on function public.orat_user_organization_id() is
  'Returns the organization_id for the current user (single-org model). Use in RLS or server logic when ready.';

grant execute on function public.orat_user_organization_id() to authenticated;
grant execute on function public.orat_user_organization_id() to service_role;
