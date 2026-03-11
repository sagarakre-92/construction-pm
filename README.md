# Owner's Rep Action Tracker (ORAT)

A web app for tracking actions, projects, and teams—built for construction and project management. Users sign in, create projects, add tasks with start/due dates and assignees, and view work in Board, List, or Timeline (Gantt) views.

---

## Main functionality

- **Authentication** — Email/password sign up and login via Supabase Auth. Email verification supported; session is refreshed via middleware.
- **Projects** — Create, edit, and archive projects. Each project has a name and description. A sidebar lists all projects; you can switch between a single project or “All projects.”
- **Tasks** — Create and edit tasks with title, description, start date, due date, assignee (internal team or external stakeholder), and company. Tasks have statuses: Not Started, In Progress, Complete; overdue tasks are marked automatically.
- **Task views**
  - **Board** — Kanban-style columns by status (Not Started, In Progress, Complete). Drag-and-drop not implemented; status is changed via task edit.
  - **List** — Sortable table of tasks with key fields.
  - **Timeline (Gantt)** — 14-day window centered on today. Task bars start and end on the task’s start and due dates; rows are grouped by company (organization). “Today” is shown with a vertical marker.
- **Task filters** — Dropdown to show All, My Tasks, Internal (assigned to internal team), or External (assigned to external stakeholders).
- **Team** — Projects have internal members (from `profiles`) and external stakeholders (name, role, company per project). Task assignees can be internal or external.
- **Settings** — App bar menu: project-specific actions (rename, archive when a project is selected) and Sign out.

The app is responsive: a collapsible sidebar on smaller screens, and layout adjustments for mobile.

---

## Tech stack

| Layer        | Technology |
|-------------|------------|
| **Framework** | Next.js 15 (App Router) |
| **Language**  | TypeScript |
| **UI**        | React 19, Tailwind CSS |
| **Components** | Radix UI (Dialog, Dropdown, Select, Tabs, Checkbox, etc.), shadcn-style primitives, CVA, `clsx` / `tailwind-merge` |
| **Charts**    | Recharts (Gantt/timeline, bar chart) |
| **Icons**     | Lucide React |
| **Toasts**    | Sonner |
| **Backend**   | Supabase (PostgreSQL + Row Level Security, Auth) |
| **Deployment**| Vercel (recommended) |
| **Monitoring**| Sentry (errors and performance) |
| **Testing**   | Vitest (unit), Playwright (E2E) |

---

## Project structure

```
src/
├── app/
│   ├── (auth)/              # Login, signup, verify-email
│   ├── auth/callback/       # Supabase auth callback
│   ├── orat/                # Main app (after login)
│   │   ├── actions.ts       # Server actions (projects, tasks, profiles)
│   │   ├── page.tsx         # ORAT dashboard + views
│   │   ├── types.ts         # Project, Task, InternalUser, ExternalStakeholder
│   │   ├── utils/           # task-utils (status, formatting)
│   │   └── components/      # ProjectsPanel, KanbanView, ListView, GanttView,
│   │                        # TaskDialog, TaskFilterDropdown, etc.
│   ├── layout.tsx
│   ├── page.tsx             # Landing (Log in / Sign up)
│   └── globals.css
├── components/ui/           # Button, dialog, dropdown, select, tabs, etc.
└── lib/supabase/            # createClient (browser, server), middleware
supabase/migrations/         # 002_orat_schema, 003 RLS, 004 create-project RPC
```

Protected route: `/orat` requires authentication; unauthenticated users are redirected to `/login`.

---

## Getting started

### Prerequisites

- Node.js 20+
- npm

### Install and run

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Log in** or **Sign up**; after auth you’ll be redirected to `/orat`.

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy **Project URL** and the **anon public** key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. In the Supabase SQL editor, run the migrations in order:
   - `supabase/migrations/002_orat_schema.sql` (profiles, orat_projects, orat_tasks, members, external stakeholders)
   - `supabase/migrations/003_orat_fix_rls_recursion.sql` (RLS fixes)
   - `supabase/migrations/004_orat_create_project_rpc.sql` (create-project RPC)
4. In **Authentication → Providers**, enable Email (and optionally email confirmation).

Without Supabase configured, the app still runs; `/orat` will show a loading or error state until env and migrations are in place.

---

## Scripts

| Command           | Description              |
|-------------------|--------------------------|
| `npm run dev`     | Start dev server         |
| `npm run build`   | Production build         |
| `npm run start`   | Start production server  |
| `npm run lint`    | Run ESLint               |
| `npm run test`    | Run Vitest (watch)       |
| `npm run test:run`| Run Vitest once          |
| `npm run test:e2e`| Run Playwright E2E       |

---

## Connecting GitHub, Vercel, Supabase & Sentry

- **Existing accounts:** See **[CONNECT.md](./CONNECT.md)** for wiring this repo to GitHub, Vercel, Supabase, and Sentry.
- **New accounts:** See **[SETUP.md](./SETUP.md)** for sign-up and connection steps.

---

## Design (Figma)

Designs and design–dev workflow: **[docs/FIGMA.md](./docs/FIGMA.md)** (if present).

---

## License

MIT
