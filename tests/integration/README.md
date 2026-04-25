# Integration tier — RLS gate

This directory holds tests that run against a **real** Postgres + Supabase
Auth stack booted by the local Supabase CLI. The unit suite uses a Proxy
fake (`src/app/orat/lib/__mocks__/supabase-fake.ts`) and stays fast; this
tier exists for one reason — to prove that **Row Level Security** is doing
its job, per the rule in `AGENTS.md`:

> RLS is the source of truth for security.

The tests sign in as two real users from two different orgs and assert
that USER_B cannot read or write USER_A's data, both through the
production data layer (`src/app/orat/lib/org-data.ts`,
`src/app/orat/actions.ts`) and via raw `supabase.from(...)` queries that
bypass any app-level org-scoping.

## Running locally

You need the [Supabase CLI](https://supabase.com/docs/guides/cli)
installed (`brew install supabase/tap/supabase`).

```bash
supabase start                       # boots Postgres + Auth + Storage
supabase db reset                    # applies supabase/migrations/*.sql
eval "$(supabase status -o env)"     # exports SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
npm run test:integration             # runs vitest with vitest.integration.config.ts
supabase stop                        # tear down when done
```

`supabase status -o env` prints `API_URL`, `ANON_KEY`, and
`SERVICE_ROLE_KEY` (no `SUPABASE_` prefix); `tests/integration/setup/env.ts`
accepts both forms, so either `eval "$(supabase status -o env)"` or
exporting the prefixed names manually will work.

## Required env vars

| Var | Default | Notes |
|---|---|---|
| `SUPABASE_URL` (or `API_URL` / `NEXT_PUBLIC_SUPABASE_URL`) | `http://127.0.0.1:54321` | Where the local stack is listening. |
| `SUPABASE_ANON_KEY` (or `ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | _required_ | Used to sign in as USER_A and USER_B. |
| `SUPABASE_SERVICE_ROLE_KEY` (or `SERVICE_ROLE_KEY`) | _required_ | Used **only** by the seed step to insert fixtures (bypasses RLS). |

The service-role client is **never** used inside an assertion — that would
defeat the entire point of the suite.

## What's here

| File | Purpose |
|---|---|
| `rls.test.ts` | The actual assertions: cross-org reads/writes are rejected; same-org reads succeed. |
| `setup/env.ts` | Tolerant env reader (accepts CLI-native or `SUPABASE_*`-prefixed names). |
| `setup/clients.ts` | `createServiceRoleClient()` for seeding; `createUserClient(email, password)` for assertions. |
| `setup/seed.ts` | Idempotent fixtures: 2 orgs, 2 users (one per org), 1 project + 1 task in ORG_A. |
| `setup/server-mock.ts` | Tiny shim that replaces `@/lib/supabase/server` so production functions can run outside a Next request. |

## CI

The GitHub Actions job `integration` in `.github/workflows/ci.yml` runs the
same flow on every push/PR: install Supabase CLI, `supabase start`,
`supabase db reset`, export env vars, `npm run test:integration`, then
`supabase stop` in cleanup. It runs in parallel with the unit / lint job
so unit tests remain fast and don't pull the CLI.
