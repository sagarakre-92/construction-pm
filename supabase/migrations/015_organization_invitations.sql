-- Organization invitations: invite by email, secure token, one per (org, email) when pending.

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  token text not null default encode(gen_random_bytes(32), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint organization_invitations_token_unique unique (token)
);

-- One pending invite per (organization_id, lower(email))
create unique index if not exists idx_organization_invitations_pending_unique
  on public.organization_invitations (organization_id, lower(email))
  where status = 'pending';

create index if not exists idx_organization_invitations_organization_id
  on public.organization_invitations(organization_id);
create index if not exists idx_organization_invitations_token
  on public.organization_invitations(token);
create index if not exists idx_organization_invitations_expires_at
  on public.organization_invitations(expires_at) where status = 'pending';

alter table public.organization_invitations enable row level security;

-- Only org owners/admins can see invites for their org (used from server)
create policy "Org owners and admins can manage invitations"
  on public.organization_invitations for all
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_invitations.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- Invited user can read their own invite by token (for accept flow; token is secret)
-- We allow select where token = ? so the accept endpoint can validate; no policy by email.
-- So we need: allow select for the row when token is known (server will pass token).
-- Actually RLS runs as the current user; during accept the user is logged in. We don't want to expose
-- all invites to everyone. So: only allow select where the row's token matches a value we're checking.
-- That's tricky in RLS because we don't pass the token in the policy. So the accept flow should use
-- a SECURITY DEFINER function that takes the token and returns the invite row if valid, and only then
-- do we add the user to the org. So the policy above is enough: only owners/admins can read/write.
-- For accept we'll use an RPC that takes the token and (if valid and not expired) adds the current user
-- to the org and marks the invite accepted. The RPC doesn't need to SELECT from invitations with RLS;
-- it runs as definer and can read the row by token.
comment on table public.organization_invitations is
  'Pending and past invitations to join an organization. Token is single-use; accept via RPC.';
