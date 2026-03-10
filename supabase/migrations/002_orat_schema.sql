-- ORAT: profiles (extends auth.users for display names)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  role text not null default '',
  company text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ORAT: projects
create table if not exists public.orat_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_date date not null default current_date,
  archived boolean not null default false,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orat_projects enable row level security;

create table if not exists public.orat_project_members (
  project_id uuid not null references public.orat_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (project_id, user_id)
);

alter table public.orat_project_members enable row level security;

-- User can read projects they are a member of or own
create policy "Users can view projects they own or are member of"
  on public.orat_projects for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.orat_project_members m
      where m.project_id = orat_projects.id and m.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create projects"
  on public.orat_projects for insert
  with check (auth.uid() = owner_id);

create policy "Project owner or member can update project"
  on public.orat_projects for update
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.orat_project_members m
      where m.project_id = orat_projects.id and m.user_id = auth.uid()
    )
  );

create policy "Project owner can delete project"
  on public.orat_projects for delete
  using (owner_id = auth.uid());

create policy "Users can view project members for their projects"
  on public.orat_project_members for select
  using (
    exists (
      select 1 from public.orat_projects p
      where p.id = project_id and (p.owner_id = auth.uid() or exists (
        select 1 from public.orat_project_members m
        where m.project_id = p.id and m.user_id = auth.uid()
      ))
    )
  );

create policy "Project owner or member can manage project members"
  on public.orat_project_members for all
  using (
    exists (
      select 1 from public.orat_projects p
      where p.id = project_id and (p.owner_id = auth.uid() or exists (
        select 1 from public.orat_project_members m
        where m.project_id = p.id and m.user_id = auth.uid()
      ))
    )
  );

-- ORAT: external stakeholders
create table if not exists public.orat_external_stakeholders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.orat_projects(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  role text not null default '',
  company text not null default ''
);

alter table public.orat_external_stakeholders enable row level security;

create policy "Users can manage external stakeholders for their projects"
  on public.orat_external_stakeholders for all
  using (
    exists (
      select 1 from public.orat_projects p
      where p.id = project_id and (p.owner_id = auth.uid() or exists (
        select 1 from public.orat_project_members m
        where m.project_id = p.id and m.user_id = auth.uid()
      ))
    )
  );

-- ORAT: tasks
create table if not exists public.orat_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.orat_projects(id) on delete cascade,
  title text not null,
  description text,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  assigned_to_external_id uuid references public.orat_external_stakeholders(id) on delete set null,
  company text not null default '',
  created_date date not null default current_date,
  start_date date not null default current_date,
  original_due_date date not null default current_date,
  current_due_date date not null default current_date,
  status text not null default 'Not Started' check (status in ('Not Started', 'In Progress', 'Complete', 'Overdue')),
  meeting_reference text,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orat_tasks enable row level security;

create policy "Users can manage tasks for their projects"
  on public.orat_tasks for all
  using (
    exists (
      select 1 from public.orat_projects p
      where p.id = project_id and (p.owner_id = auth.uid() or exists (
        select 1 from public.orat_project_members m
        where m.project_id = p.id and m.user_id = auth.uid()
      ))
    )
  );

-- Trigger for profiles updated_at
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Trigger for orat_projects updated_at
create trigger orat_projects_updated_at
  before update on public.orat_projects
  for each row execute function public.set_updated_at();

-- Trigger for orat_tasks updated_at
create trigger orat_tasks_updated_at
  before update on public.orat_tasks
  for each row execute function public.set_updated_at();
