# AGENTS.md

> Read this file before starting any task in this repo. It is the canonical
> briefing for AI coding agents (Cursor, Codex, Claude Code, Copilot, etc.).

## What this app is

**Owner's Rep Action Tracker (ORAT)** — a Next.js web app for construction /
project-management teams to track projects and tasks across organizations.
Users sign in, create an organization, invite teammates, then create projects
and tasks (with start/due dates, assignees, status). Tasks are visualized in
**Board / List / Timeline (Gantt)** views. The main protected app lives at
`/orat`; everything outside is auth/onboarding/marketing.

## Tech stack (must match existing patterns)

| Layer        | Technology                                                              |
|--------------|-------------------------------------------------------------------------|
| Framework    | **Next.js 15 (App Router)** — server components by default              |
| Language     | **TypeScript** (`strict`), no `any`                                     |
| UI           | **React 19**, **Tailwind CSS 3**, **Radix UI** primitives + shadcn-style|
| State/data   | **Server Actions** (`"use server"`) — no REST/tRPC layer                |
| Backend      | **Supabase** (Postgres, Auth, RLS) via `@supabase/ssr`                  |
| Charts       | Recharts                                                                |
| Icons        | `lucide-react`                                                          |
| Toasts       | `sonner`                                                                |
| Testing      | **Vitest** (unit, jsdom), **Playwright** (E2E)                          |
| Monitoring   | **Sentry** (`@sentry/nextjs`) — only enabled when env vars are set      |
| Deploy       | Vercel                                                                  |

## Repo map (the 30-second tour)

```
src/
├── app/
│   ├── (auth)/                # /login, /signup, verify-email
│   ├── auth/callback/         # Supabase OAuth/email callback
│   ├── onboarding/            # First-time org creation
│   ├── orat/                  # Main app (auth-required)
│   │   ├── page.tsx           # Dashboard (Board/List/Gantt switcher)
│   │   ├── actions.ts         # Server actions (thin facade → lib/org-data)
│   │   ├── lib/org-data.ts    # Org-scoped data layer (THE source of truth)
│   │   ├── components/        # KanbanView, ListView, GanttView, dialogs…
│   │   ├── organization/      # Org settings, invite form
│   │   ├── utils/             # task-utils (status/date helpers)
│   │   └── types.ts           # Project, Task, Organization, etc.
│   ├── invite/                # /invite/[token] — accept org invitation
│   ├── api/                   # Route handlers (rare — prefer server actions)
│   └── layout.tsx
├── components/ui/             # shadcn primitives (button, dialog, select, …)
├── lib/
│   ├── supabase/              # createClient (browser, server, middleware)
│   └── utils.ts               # `cn()` only
├── middleware.ts              # Refreshes Supabase session on every request
└── types/                     # Cross-cutting types
supabase/migrations/           # Numbered SQL migrations (NNN_name.sql)
e2e/                           # Playwright specs
```

## Required reading before working on…

| If your task touches…           | Read first                                                    |
|---------------------------------|---------------------------------------------------------------|
| Tasks, projects, queries        | `src/app/orat/lib/org-data.ts` (org scoping + auth checks)    |
| New DB columns / tables / RPCs  | `supabase/migrations/` last few files for naming + RLS style  |
| A new view (Board/List/Gantt)   | `src/app/orat/components/KanbanView.tsx` as a reference       |
| A new UI primitive              | `src/components/ui/button.tsx` (CVA + `cn()` pattern)         |
| Auth flow                       | `src/lib/supabase/middleware.ts`, `src/app/(auth)/`           |
| Onboarding / orgs / invitations | `docs/ORGANIZATION_*.md`, migration files 005+                |

## Core conventions (non-negotiable)

1. **Server-first.** New components are **Server Components** unless they need
   browser-only state/effects, in which case mark `"use client"` at the top.
2. **Mutations go through Server Actions** in `src/app/orat/actions.ts`
   (or a new `actions.ts` colocated with a route segment). Do **not** add a
   route handler under `src/app/api/` for things server actions can do.
3. **Every query is org-scoped.** Use the helpers in
   `src/app/orat/lib/org-data.ts` (`getProjectsForOrganization`,
   `ensureProjectInCurrentOrg`, `ensureTaskInCurrentOrg`, etc.). Never write a
   `from("orat_projects")` query in a component or new action without going
   through that layer or replicating its `organization_id` checks.
4. **RLS is the source of truth for security.** App-level checks are belt +
   suspenders; the database must enforce access. Every new table needs:
   - `enable row level security`
   - explicit `policy` for select/insert/update/delete
   - mirror existing org-membership patterns from migrations 010–011.
5. **Types live in `types.ts` next to the feature.** Never invent ad-hoc
   shapes inside components. The shared task types are in
   `src/app/orat/types.ts`.
6. **UI styling = Tailwind + `cn()`.** No styled-components, no CSS modules.
   Use the `cn()` helper from `@/lib/utils` to merge classes.
7. **Variants = CVA.** New design-token variants of UI primitives use
   `class-variance-authority` — see `src/components/ui/button.tsx`.
8. **Imports use the `@/` alias** (configured in `tsconfig.json`) — never
   relative `../../../`.
9. **No `any`.** Use `unknown` + a narrowing type guard, or define a real
   type. ESLint will fail the build otherwise.
10. **Don't introduce new top-level dependencies without explanation** in the
    chat / PR. The bundle is intentionally small.

## Commands

```bash
npm run dev          # http://localhost:3000
npm run build        # production build
npm run lint         # next lint (ESLint 9, eslint-config-next)
npm run test:run     # Vitest once (use `test` for watch)
npm run test:e2e     # Playwright (auto-starts dev server via playwright.config)
```

The dev server, lint, and Vitest must all pass before declaring a task done.
E2E is optional locally but runs in CI.

## Environment

Required (in `.env.local`, see `.env.local.example`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional (skip if blank — code branches on presence):
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`

## Database / migrations

- Files: `supabase/migrations/NNN_short_name.sql` — **strictly increment NNN**
  (zero-padded to 3 digits) using the next available number.
- Each migration is **idempotent** where possible (`if not exists`,
  `create or replace`) so it survives re-runs in dev.
- After writing the SQL, apply it via the Supabase SQL editor (or `supabase db
  push` if the local CLI is wired). Do **not** rely on auto-apply.
- For new RPCs: `security definer`, `set search_path = public, auth`, validate
  `auth.uid()` first, then perform org-membership checks. See migration `017`
  for the canonical shape.

## Testing expectations

- **Unit (Vitest)** — colocate as `*.test.ts(x)` next to the file under test.
  See `src/app/orat/lib/org-data.test.ts` for the Supabase-mocking style we
  use (build a tiny chainable stub; assert the captured `organization_id`).
- **E2E (Playwright)** — specs under `e2e/`. Use `getByLabel` / `getByRole`
  semantic queries (see `e2e/auth.spec.ts`). Avoid CSS selectors.

## Skills folder — `.cursor/skills/`

Repeatable workflows (e.g. "add a Supabase migration", "add a new view") live
in `.cursor/skills/<name>/SKILL.md`. **If a skill exists for what you're
about to do, read and follow it.** Index:

- `add-supabase-migration/` — schema changes done the right way (+ RLS)
- `add-task-view/` — add a new task view alongside Board/List/Gantt
- `add-shadcn-component/` — add a new UI primitive in our style
- `write-e2e-test/` — Playwright test in this repo's idiom
- `tdd/` — red-green-refactor TDD workflow (vertical slices, behavior-not-implementation tests). **Use this whenever building a feature or fixing a bug test-first.**

Skills sourced from external repos are installed via the `skills` CLI and
tracked in `skills-lock.json` at the repo root. The actual files live in
`.agents/skills/<name>/`; `.cursor/skills/<name>` is a symlink so Cursor
discovers them. To update: `npx skills update`. To add another:
`npx skills add <user>/<repo>/<skill>`.

## Project rules — `.cursor/rules/`

Always-on or file-scoped guidance:
- `nextjs-conventions.mdc` (always-on) — App Router / server actions
- `supabase-conventions.mdc` (`supabase/**`, `**/lib/supabase/**`) — RLS, RPCs
- `ui-conventions.mdc` (`src/components/**`, `**/*.tsx`) — Tailwind / Radix

## Anti-patterns (what NOT to do)

- ❌ Adding `useEffect`-driven data fetching in a client component when a
  server component + server action would do.
- ❌ Querying Supabase tables directly from a component.
- ❌ Trusting `auth.uid()` only on the client; always re-check in RLS / RPC.
- ❌ Creating a new `app/api/*` route to do what a server action can do.
- ❌ Editing `node_modules` / committing build output (`.next/`).
- ❌ Hardcoding the org or project — always derive from the current user's
  organization (`getCurrentOrganization()`).
- ❌ Adding heavy charting libs (we already use `recharts`).
- ❌ Switching CSS strategies (no Emotion, styled-components, sass).

## When in doubt

1. Find the closest analogous file/feature and copy its shape.
2. If the convention isn't obvious, ask the user — don't invent a new one.
3. Prefer the smallest possible diff.
