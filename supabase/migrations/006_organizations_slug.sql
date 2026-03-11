-- Step 2: First-class organization model – add slug to organizations.
-- Table already exists from 005; this adds slug (unique, not null) only.
-- No UI changes. No new membership tables. RLS unchanged.

-- Add slug column (nullable initially for backfill)
alter table public.organizations
  add column if not exists slug text;

-- Backfill existing rows so we can set NOT NULL (use id so each row has a unique value)
update public.organizations
  set slug = 'org-' || id::text
  where slug is null;

-- Enforce NOT NULL and UNIQUE
alter table public.organizations
  alter column slug set not null;

-- Unique constraint on slug (create unique index to avoid duplicate constraint name if re-run)
create unique index if not exists idx_organizations_slug
  on public.organizations(slug);

comment on column public.organizations.slug is
  'URL-safe unique identifier for the organization. Set by app or RPC when creating orgs.';
