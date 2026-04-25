# Test Coverage Audit

> Date: 2026-04-25
> Scope: ORAT (`construction-pm`) — Vitest unit tests + Playwright E2E
> Status: **Suite is currently red.** `npm run test:run` exits 1 on a clean
> checkout; CI runs the same script. Prioritized fixes are at the bottom.

A staff-eng review of unit + integration coverage. Findings are grounded in
what runs locally today and what the suite would actually catch if it were
green.

## Snapshot

| Metric | Value |
|---|---|
| Source files (`src/**/*.{ts,tsx}`) | 53 |
| Vitest test files | 2 (`org-data.test.ts`, `login/page.test.tsx`) |
| Playwright spec files | 3 (`auth.spec.ts`, `dashboard.spec.ts`, `home.spec.ts`) + 1 unrunnable `.feature` stub |
| Vitest tests passing locally | 4 of 8 |
| Vitest tests broken locally | 4 of 8 (2 failing assertions + 2 that can't load) |
| Playwright specs that target current routes/copy | 1 of 3 (`auth.spec.ts`) |

"Tests passing" counts only Vitest cases. Playwright is currently unrunnable
as a fair signal: the home and dashboard specs target headings/routes that no
longer exist, and the only auth-protected user surface (`/orat`) has no E2E
coverage at all.

---

## 1. The suite is red right now

Before talking about coverage, the suite that exists doesn't run.

| Test | What breaks | Root cause | Fix |
|---|---|---|---|
| `src/app/(auth)/login/page.test.tsx` | Suite fails to load (0 of 2 tests run) | `@testing-library/react` peer dep `@testing-library/dom` is not installed. | Add `@testing-library/dom` and `@testing-library/jest-dom` to devDeps; create a `vitest.setup.ts` that imports `@testing-library/jest-dom/vitest`. |
| `org-data → returned projects have organizationId set` | `supabase.from().select().in().order is not a function` | Hand-rolled mock returns `{ data, error }` after the first `.order()`; production code chains `.in().order().order().order()`. | Make the mock return a chainable object until the chain terminates, or replace with a recorder fake. |
| `org-data → getTasksForProject filters by both ids` | `...eq().eq().order().order is not a function` | Same root cause: chained `.order()` calls don't survive the mock. | Same fix as above. Both failures collapse into one once the mock matches the call sites. |
| `e2e/home.spec.ts` (×3) | All 3 assert `/construction pm/i` but the actual h1 is "Owner's Rep Action Tracker". | The string lives in `metadata.title` only; the visible heading was renamed and the spec wasn't updated. | Update assertions to match the rendered heading, or delete and replace with a brand-agnostic smoke test. |
| `e2e/dashboard.spec.ts` (×2) | Both visit `/dashboard` and `/tasks`, which `middleware.ts` (lines 33–36) redirects to `/orat`, which then redirects unauthenticated users to `/login`. | Routes were collapsed into `/orat` but the spec was never migrated. | Delete this file. Replace with a real `/orat` spec that uses programmatic auth (see §5). |

Reproduce locally:

```bash
npm run test:run     # exits 1 with the failures above
npm run test:e2e     # home + dashboard specs fail against current copy
```

---

## 2. What the four passing tests actually prove

The four green tests in `src/app/orat/lib/org-data.test.ts` live near the
most security-critical layer in the app — org scoping. They're worth
keeping, but the assertions are loose enough that the implementation could
regress in important ways and the tests would still pass.

| Test | What it claims | What it actually checks | Signal strength |
|---|---|---|---|
| `getProjectsForOrganization filters by organization_id` | Project list query is org-scoped. | That the captured `organization_id` equals `ORG_A`, plus a no-op `expect(...).toBeDefined()`. No assertion on returned data shape, the projects→members→externals→tasks join, or ordering. | Weak — single bind only |
| `createProjectForOrganization rejects org mismatch` | Cross-org create is blocked. | That `{ error }` is returned and the message matches `/organization|mismatch|denied/i`. Does not cover the success path, the `orat_create_project` RPC call, the team-member insert, or the external-stakeholder insert. | Negative path only |
| `ensureProjectInCurrentOrg rejects different-org project` | Mutation guard works for projects in another org. | Constructs a fresh mock returning a project row with `organization_id: ORG_B` and asserts an error matching `/not in your organization/i`. Does not exercise the "allowed" branch or the "project not found" branch. | Decent but partial |
| `ensureTaskInCurrentOrg rejects different-org task` | Mutation guard works for tasks. | Mirror of the project test above; same shape, same gaps. | Decent but partial |

---

## 3. User-facing features mapped to coverage

Grouped by what a user actually does. "Has tests" means tests that
meaningfully assert on the behavior — not just that an import resolves.

| Feature area | Surface area | Has tests | Notable gap |
|---|---|---|---|
| Auth — sign in / sign up forms | `/(auth)/login`, `/(auth)/signup`, `auth.spec.ts` | Yes (E2E) | Only renders fields and link navigation. The actual `signInWithPassword` / `signUp` success and error branches, the `?verified=1` banner, and the `?error=auth_callback_failed` banner are untested. |
| Email verification callback | `/auth/callback/route.ts`, `signup-email-verification.feature` | **No** | The `.feature` file is a Gherkin spec with no runner — pure documentation. The route's `code`/`next` branching, sign-out after verification, and the `verified=1` redirect have zero tests. |
| Onboarding — create org + profile | `OnboardingForm`, `completeOnboarding` | Indirect | `completeOnboarding` is the entry point for every new user. No unit test covers the org+profile transaction; no E2E walks the form. Failure here means new users are stuck. |
| Project CRUD | `createProject`, `updateProject`, `archiveProject`, dialogs | Partial | Only `createProjectForOrganization` has a negative-path test. `updateProject`'s membership reconciliation, external-stakeholder diff (insert vs update vs delete), and ownership preservation are untested — and that's where the bugs will be. |
| Task CRUD + status transitions | `createTask`, `updateTask`, `updateTaskStatus`, `deleteTask` | **No** | `parseAssignee` (internal vs external resolution), history append on status change, and overdue auto-promotion via `getEffectiveStatus` all have zero tests. These run on every status change in production. |
| Drag-drop reorder + cross-column move | `KanbanView`, `reorderTasks`, `/api/orat/reorder` | **No** | The reorder route is the only `/api/*` handler in the app and re-implements org-scoping itself. Untested. Optimistic update + rollback in `page.tsx` is also untested. |
| Date / status helpers | `task-utils.ts`: `isOverdue`, `getEffectiveStatus`, `formatDate`, `getStatusBadgeVariant` | **No** | Pure functions used by Kanban, List, Gantt, and `DashboardMetrics`. `TODAY` is captured at module load — a known timezone footgun. Easy unit-test wins; high blast radius if wrong. |
| Organization management | `/orat/organization`, `OrganizationInviteForm`, `createInvitation`, `acceptInvitation` | **No** | Role gating (`owner|admin`), invite-link assembly (with `NEXT_PUBLIC_APP_URL` / `VERCEL_URL` fallback), and the `/invite/[token]` page (auth gate, accept, redirect) have zero tests. |
| Filtering & dashboard metrics | `TaskFilterDropdown`, `displayTasks`, `DashboardMetrics` | **No** | The `my-tasks` / `internal` / `external` filter logic, the "all projects excludes archived" rule, and the metric counts are pure derivations that beg for unit tests. |
| Bulk select + clipboard copy | `BulkActionsToolbar`, `formatTasksForClipboard` | **No** | `formatTasksForClipboard` is currently inlined in `page.tsx`; not exported, not testable. Extract and cover. |
| Middleware / route protection | `src/lib/supabase/middleware.ts` | **No** | Three real behaviors in 49 lines: legacy-route redirects, auth gate for `/orat` + `/onboarding`, no-op when env vars are missing. None tested. |

Also worth knowing: `src/app/orat/components/TaskOwnershipFilter.tsx` is dead
code (no importers). Worth deleting in the same pass as the test cleanup.

---

## 4. Structural problems with the current strategy

### The Supabase mock is a fixture, not a fake
`org-data.test.ts` rebuilds a chainable object by hand for every test. The
chain "ends" at whatever depth the author predicted, so any new `.order()`,
`.in()`, or `.eq()` in the production code silently breaks the mock — exactly
what happened here. Two tests already failing prove the maintenance cost.
Replace with a tiny query-recorder that returns a Proxy, or import a
well-tested fake.

### No layer between mocks and full E2E
Today the choice is "mock the entire Supabase client" or "run a browser
against placeholder Supabase credentials." There's no integration tier — no
way to call `createTask` against a real schema and prove that RLS rejects a
cross-org write. RLS is **the** security model per `AGENTS.md`, but nothing
exercises it. Wire up `supabase start` in CI, seed two orgs, and run server
actions for real.

### E2E only covers public pages
The protected app at `/orat` — which is the entire product — has zero E2E
coverage. The skill in `.cursor/skills/write-e2e-test/SKILL.md` already
documents two auth strategies, but the helper at `e2e/helpers/auth.ts`
doesn't exist yet. Build the programmatic-auth helper first; every
meaningful E2E depends on it.

### CI runs E2E against placeholder Supabase credentials
`.github/workflows/ci.yml` sets
`NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co` for the E2E job.
No Supabase request can succeed, so any test that touches data is implicitly
limited to the marketing/login shell. This needs a real (or local) Supabase
project to be a meaningful gate.

---

## 5. Recommended priorities

Ordered by "most leverage per hour." The first two are prerequisites for
everything below.

| # | Action | Why now | Effort |
|---:|---|---|---|
| 1 | Make `npm run test:run` green: install `@testing-library/dom`, fix the org-data Supabase mock chain. | CI is currently failing on every PR. Until this is true, every other coverage discussion is theoretical. | ~1 hr |
| 2 | Delete `e2e/dashboard.spec.ts` and rewrite `e2e/home.spec.ts` against current copy. | Stops false negatives. Both specs assert against routes/headings that no longer exist. | ~30 min |
| 3 | Add unit tests for `task-utils.ts`: `isOverdue`, `getEffectiveStatus`, `formatDate`, `getStatusBadgeVariant`. Inject "today" instead of capturing it at module load. | Pure functions, no Supabase, hit by every view. The Overdue auto-promotion is implicit business logic — write tests, then refactor `TODAY` out of module scope. | ~1 hr |
| 4 | Build `e2e/helpers/auth.ts` (programmatic Supabase login → cookie). Add one E2E that creates a project, creates a task, drags it to In Progress, refreshes, and asserts the new column. | Smallest change that turns the E2E suite from "login form smoke test" into actual product coverage. Unblocks every protected-page spec after it. | ~half day |
| 5 | Replace the hand-rolled Supabase mock with a thin recorder fake; expand `org-data` tests to include success paths and cover `updateProject`, `updateTask`, `updateTaskStatus`, `reorderTasks`, `deleteTask`. | Server actions are where org-scoping is enforced in app code. The mutation paths have zero tests today and silently rely on RLS as a backstop. | ~1 day |
| 6 | Stand up `supabase start` in CI for an integration tier. Seed two orgs + two users, then assert that `getProjectsForOrganization(ORG_A)` with USER_B's session returns nothing — i.e. RLS works. | `AGENTS.md` says "RLS is the source of truth for security." Right now nothing actually verifies that claim. One end-to-end RLS test catches whole classes of regressions. | ~1 day |
| 7 | Add coverage reporting (`vitest --coverage` with `@vitest/coverage-v8`), fail PRs below a threshold for `src/app/orat/lib/**` and `src/app/orat/utils/**`. | Cheap once tests exist. Keeps the bar from drifting back down. | ~30 min |

---

## Bottom line

The repo has the right **conventions** for testing — colocated Vitest specs,
Playwright in `e2e/`, a SKILL doc explaining the idiom, CI that runs both —
but the actual coverage is one thin slice (login form rendering + four loose
org-scoping asserts), and that slice is currently red. Every mutation path,
every view interaction, every middleware decision, the entire invitation
flow, and the security model itself ship without an automated check. Fix
the broken tests this week, then build the programmatic-auth E2E helper —
that one piece of plumbing unlocks almost every test worth writing next.
