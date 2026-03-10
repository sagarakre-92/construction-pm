# Construction PM

A production-oriented Next.js app for construction project management, with TypeScript, Supabase, and full test coverage.

## Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (auth + database)
- **Sentry** (error monitoring)
- **Vitest** (unit tests)
- **Playwright** (E2E tests)
- **GitHub Actions** (CI)

## Connecting GitHub, Vercel, Supabase & Sentry

**Already have accounts?** Use **[CONNECT.md](./CONNECT.md)** — it only covers connecting this project to each service and what to copy where.

**Need to create accounts first?** Use **[SETUP.md](./SETUP.md)** — it walks you through signing up and connecting:

1. **GitHub** – store your code and push the project  
2. **Vercel** – host the app and get a live URL  
3. **Supabase** – database and login/sign up  
4. **Sentry** – error and performance monitoring  

Each step tells you exactly what to click and what to copy into Vercel.

## Getting started

### Prerequisites

- Node.js 20+
- npm

### Install and run

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local with your Supabase URL and anon key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.
3. Run the migration to create the `tasks` table and RLS:

   In the Supabase SQL editor, run the contents of `supabase/migrations/001_create_tasks.sql`.

4. Enable Email auth (or your preferred provider) in Authentication → Providers.

Without Supabase configured, the app still runs; the tasks page will show an error until env vars are set and the migration is applied.

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm run dev`  | Start dev server         |
| `npm run build`| Production build         |
| `npm run start`| Start production server  |
| `npm run lint` | Run ESLint               |
| `npm run test` | Run Vitest (watch)       |
| `npm run test:run` | Run Vitest once      |
| `npm run test:e2e` | Run Playwright E2E   |

## Project structure

```
src/
├── app/
│   ├── (auth)/          # Auth route group: login, signup
│   ├── (dashboard)/     # Dashboard group: dashboard, tasks
│   ├── layout.tsx
│   ├── page.tsx         # Home
│   └── globals.css
├── components/
│   └── tasks/           # Task list, form, item
├── lib/
│   └── supabase/        # Browser, server, and middleware clients
├── types/
│   └── database.ts      # Supabase table types
└── middleware.ts        # Supabase session refresh
e2e/                     # Playwright specs
supabase/
└── migrations/          # SQL migrations
```

## CI

The `.github/workflows/ci.yml` workflow runs on push/PR to `main` or `master`:

1. Lint and unit tests
2. Build (with placeholder Supabase env)
3. E2E tests (Chromium only in CI)

## License

MIT
