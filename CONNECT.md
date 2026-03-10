# Connect Your Existing Accounts

You have GitHub, Vercel, Supabase, and Sentry. Follow these steps to connect them to this project.

---

## Step 1: GitHub — Put the project in a repo

1. On GitHub, click **+** → **New repository**.
2. Name it (e.g. `construction-pm`), leave it **Public**, don’t add a README. Create the repo.
3. On your computer, open Terminal (or Command Prompt) and run (replace `YOUR_USERNAME` with your GitHub username):

```bash
cd /Users/sagarakre/construction-pm
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/construction-pm.git
git push -u origin main
```

If it asks for a password, use a **Personal Access Token**: GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Generate new token** (enable **repo**), then paste the token as the password.

---

## Step 2: Vercel — Import and deploy

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. **Add New…** → **Project**.
3. Select your **construction-pm** repo and click **Import**.
4. **Do not deploy yet.** Click **Environment Variables** (or go to the project after import → **Settings** → **Environment Variables**). Leave this tab open; you’ll add variables in Steps 3 and 4.
5. When you’re done adding all variables below, go to **Deployments** → open the **⋯** on the latest deployment → **Redeploy**.

---

## Step 3: Supabase — Get keys and create the table

1. Go to [supabase.com](https://supabase.com) and open your project (or create one).
2. **Project Settings** (gear) → **API**.
   - Copy **Project URL**.
   - Under **Project API keys**, copy the **anon public** key.
3. In Vercel (your project → **Settings** → **Environment Variables**), add:

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | (paste Project URL) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (paste anon key) |

   Add to **Production**, **Preview**, and **Development**. Save.

4. In Supabase, open **SQL Editor** → **New query**.
5. Open the file `supabase/migrations/001_create_tasks.sql` from this project, copy **all** of it, paste into the query box, click **Run**.
6. **Authentication** → **Providers** → **Email** → make sure it’s **Enabled**. Save.

---

## Step 4: Sentry — Get DSN and auth token

1. Go to [sentry.io](https://sentry.io) and open your project (or create a **Next.js** project).
2. **Settings** → **Client Keys (DSN)**. Copy the **DSN**.
3. In the Sentry URL you’ll see: `organizations/ORG_SLUG/projects/PROJECT_SLUG/`. Note **ORG_SLUG** and **PROJECT_SLUG**.
4. Your profile (bottom left) → **User Settings** → **Auth Tokens** → **Create New Token**.
   - Name it (e.g. `Vercel`).
   - Scopes: enable **project:releases** and **org:read**. Create, then **copy the token** (you won’t see it again).
5. In Vercel (**Settings** → **Environment Variables**), add:

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_SENTRY_DSN` | (paste DSN) |
   | `SENTRY_ORG` | (your org slug) |
   | `SENTRY_PROJECT` | (your project slug) |
   | `SENTRY_AUTH_TOKEN` | (paste auth token) |

   Add to **Production**, **Preview**, and **Development**. Save.

---

## Step 5: Redeploy on Vercel

1. Vercel → your project → **Deployments**.
2. On the latest deployment, click **⋯** → **Redeploy**.
3. Wait for the build to finish. Open your app URL — login, signup, and tasks should work; errors will show in Sentry.

---

## Summary: What goes where

| You need | Get it from | Add it in Vercel as |
|----------|--------------|---------------------|
| Supabase URL | Supabase → Project Settings → API → Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Supabase anon key | Supabase → Project Settings → API → anon public | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Sentry DSN | Sentry → Settings → Client Keys (DSN) | `NEXT_PUBLIC_SENTRY_DSN` |
| Sentry org slug | URL: `.../organizations/THIS_PART/...` | `SENTRY_ORG` |
| Sentry project slug | URL: `.../projects/THIS_PART/` | `SENTRY_PROJECT` |
| Sentry auth token | Sentry → User Settings → Auth Tokens → Create | `SENTRY_AUTH_TOKEN` |

---

## Local development

To run the app on your machine with the same backend:

1. Copy `.env.local.example` to `.env.local`.
2. Paste the same values you added in Vercel into `.env.local`.
3. Run: `npm install` then `npm run dev`. Open http://localhost:3000.
