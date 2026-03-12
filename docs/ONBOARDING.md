# Organization onboarding

When a new user signs up and logs in and does **not** belong to any organization, they are redirected to `/onboarding` to create their first organization. After creation they are sent to the main app (`/orat`).

---

## Flow

1. User signs up and logs in.
2. App checks if the user has an organization (via `organization_members`).
3. If no membership: user is redirected to **/onboarding** (from `/orat` layout).
4. Onboarding page: form with **organization name** only.
5. On submit: server action calls **orat_create_organization** RPC (creates `organizations` row + `organization_members` row with `role = 'owner'`).
6. On success: redirect to **/orat**; user now has an org and passes the layout check.

---

## Where the organization check lives

- **ORAT layout** (`src/app/orat/layout.tsx`): async server component that calls `getCurrentOrganization()`. If not authenticated → redirect to `/login`. If `data === null` (no org) → redirect to `/onboarding`. Otherwise render children.
- **Onboarding page** (`src/app/onboarding/page.tsx`): server component that calls `getCurrentOrganization()`. If not authenticated → redirect to `/login`. If user already has an org → redirect to `/orat`. Otherwise render the form.
- **Middleware** (`src/lib/supabase/middleware.ts`): treats `/onboarding` as protected; unauthenticated users hitting `/onboarding` are redirected to `/login`.

---

## Migration

Run **012_onboarding_create_organization.sql** (e.g. `supabase db push` or SQL Editor). It:

- Adds **owner** to the `organization_members.role` check.
- Creates **orat_create_organization(p_name text)** (SECURITY DEFINER):
  - Requires authenticated user.
  - Raises if user already belongs to an org (single-org onboarding).
  - Inserts into `organizations` (name, slug) and `organization_members` (user_id, role = 'owner').
  - Returns the new organization id.

No new RLS policies: org and membership are created only via this RPC, so users cannot create orgs for other users.

---

## Manual steps

1. **Run migration 012** in Supabase (SQL Editor or `supabase db push`).
2. **Test with a new user:** Sign up with an email not yet in `organization_members`. After login you should land on `/orat`, then be redirected to `/onboarding`. Create an organization; you should be redirected to `/orat` and be able to create projects.
3. **Test with existing user:** Log in as a user who already has an org. Visiting `/onboarding` should redirect to `/orat`.

---

## What to test manually

- [ ] New user (no org): login → redirect to `/onboarding` → submit org name → redirect to `/orat`, can create projects.
- [ ] New user: empty org name → validation error.
- [ ] Existing user: open `/onboarding` directly → redirect to `/orat`.
- [ ] Logged out: open `/onboarding` → redirect to `/login`.
- [ ] After creating org: `organization_members` has one row with `role = 'owner'` for that user.
