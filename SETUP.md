# How to Connect Construction PM to GitHub, Vercel, Supabase, and Sentry

This guide walks you through connecting your project to all four services. Do the steps in order. You can use a single email (e.g. Gmail) for every account.

---

## Part 1: GitHub (where your code lives)

GitHub stores your code and lets Vercel and others connect to it.

### 1.1 Create a GitHub account (if you don’t have one)

1. Go to **https://github.com**
2. Click **Sign up**
3. Enter your email, a password, and a username
4. Verify your email if asked

### 1.2 Create a new repository (“repo”)

1. Log in to GitHub
2. Click the **+** at the top right → **New repository**
3. **Repository name:** type `construction-pm` (or any name you like)
4. Leave **Public** selected
5. **Do not** check “Add a README” (your folder already has code)
6. Click **Create repository**

### 1.3 Put your project on GitHub

Open **Terminal** (Mac) or **Command Prompt** (Windows) and run these commands **one at a time**. Replace `YOUR_GITHUB_USERNAME` with your real GitHub username.

```bash
cd /Users/sagarakre/construction-pm
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/construction-pm.git
git push -u origin main
```

When it asks for username/password, use your GitHub username and a **Personal Access Token** (not your normal password). To create one: GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Generate new token**, give it “repo” permission, then paste that token when Terminal asks for a password.

---

## Part 2: Vercel (where your app is hosted)

Vercel will build and host your app and give you a URL like `construction-pm.vercel.app`.

### 2.1 Sign up and import the project

1. Go to **https://vercel.com**
2. Click **Sign Up** and choose **Continue with GitHub**
3. Log in to GitHub if asked and allow Vercel to access your account
4. After signup, click **Add New…** → **Project**
5. Find **construction-pm** in the list and click **Import**
6. Leave all settings as they are and click **Deploy**
7. Wait until the deployment finishes (about 1–2 minutes). You’ll get a link like `https://construction-pm-xxxx.vercel.app`

You’ll add environment variables in the next parts; the app may show errors until Supabase is set up.

### 2.2 Where to add environment variables later

You’ll come back to Vercel to add secrets:

1. Open your project on Vercel
2. Go to **Settings** → **Environment Variables**
3. Add each variable (name and value), then save

---

## Part 3: Supabase (database and login)

Supabase gives you a database and user accounts (login/sign up).

### 3.1 Create a Supabase project

1. Go to **https://supabase.com**
2. Click **Start your project** and sign up (e.g. with GitHub)
3. Click **New Project**
4. **Name:** e.g. `construction-pm`
5. **Database Password:** create a strong password and **save it somewhere safe**
6. **Region:** pick one close to you
7. Click **Create new project** and wait until it’s ready (1–2 minutes)

### 3.2 Get your project URL and key

1. In the left sidebar click **Project Settings** (gear icon)
2. Click **API** in the left menu
3. You’ll see:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **Project API keys** → **anon public** (a long string starting with `eyJ...`)
4. Copy both and keep them handy

### 3.3 Create the tasks table

1. In Supabase, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase/migrations/001_create_tasks.sql` from your project in a text editor
4. Copy **all** of its contents and paste into the Supabase SQL editor
5. Click **Run** (or press Ctrl+Enter / Cmd+Enter)
6. You should see “Success. No rows returned”

### 3.4 Turn on Email auth (for login/sign up)

1. In Supabase, go to **Authentication** → **Providers**
2. Click **Email**
3. Make sure **Enable Email provider** is ON
4. (Optional) Turn off **Confirm email** if you want to test without confirming emails
5. Click **Save**

### 3.5 Add Supabase keys to Vercel

1. Go to **Vercel** → your **construction-pm** project → **Settings** → **Environment Variables**
2. Add:

| Name                         | Value                    |
|-----------------------------|--------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`  | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key   |

3. Select **Production**, **Preview**, and **Development**
4. Click **Save**
5. Go to **Deployments**, click the **⋯** on the latest deployment, and choose **Redeploy** so the new variables are used

---

## Part 4: Sentry (error monitoring)

Sentry records errors and performance so you can fix issues quickly.

### 4.1 Create a Sentry account and project

1. Go to **https://sentry.io**
2. Click **Get Started** and sign up (e.g. with GitHub)
3. When asked “What’s your project’s platform?”, choose **Next.js**
4. **Project name:** e.g. `construction-pm`
5. Click **Create Project**

### 4.2 Get your DSN and auth token

**DSN (Data Source Name):**

1. In Sentry, open your project
2. Go to **Settings** → **Client Keys (DSN)**
3. Copy the **DSN** (looks like `https://xxxx@xxxx.ingest.sentry.io/xxxx`)

**Auth token (for source maps):**

1. In Sentry, click your profile (bottom left) → **User Settings**
2. Go to **Auth Tokens**
3. Click **Create New Token**
4. **Name:** e.g. `Vercel` or `construction-pm`
5. Under **Scopes**, enable **project:releases** and **org:read**
6. Click **Create Token**
7. Copy the token (starts with `sntrys_...`) and save it somewhere safe; you won’t see it again

**Org and project slugs:**

1. In Sentry, open your project
2. In the URL you’ll see something like: `sentry.io/organizations/YOUR-ORG/projects/YOUR-PROJECT/`
3. **Org slug** = `YOUR-ORG`, **Project slug** = `YOUR-PROJECT`

### 4.3 Add Sentry to Vercel

1. Go to **Vercel** → your project → **Settings** → **Environment Variables**
2. Add:

| Name                         | Value                    |
|-----------------------------|--------------------------|
| `NEXT_PUBLIC_SENTRY_DSN`    | Your Sentry DSN          |
| `SENTRY_ORG`                | Your Sentry org slug     |
| `SENTRY_PROJECT`            | Your Sentry project slug |
| `SENTRY_AUTH_TOKEN`         | Your Sentry auth token   |

3. For each variable, select **Production**, **Preview**, and **Development**
4. Click **Save**
5. **Redeploy** the latest deployment (Deployments → ⋯ → Redeploy) so the new variables are used

### 4.4 (Optional) Connect Sentry to GitHub

1. In Sentry, go to **Settings** → **Integrations**
2. Find **GitHub** and click **Install**
3. Authorize Sentry to access your GitHub and choose the **construction-pm** repo
4. This lets Sentry link errors to the exact line in your code

---

## Quick checklist

- [ ] **GitHub:** Repo created and code pushed
- [ ] **Vercel:** Project imported and first deploy done
- [ ] **Supabase:** Project created, `001_create_tasks.sql` run, Email provider enabled
- [ ] **Vercel env:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` added and redeployed
- [ ] **Sentry:** Project created, DSN and auth token copied
- [ ] **Vercel env:** `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` added and redeployed

---

## Running the app on your computer

To run the app locally with the same services:

1. Copy **.env.local.example** to **.env.local**
2. Fill in the same values you added in Vercel (Supabase URL and key; Sentry DSN, org, project, auth token if you use Sentry)
3. In Terminal: `cd /Users/sagarakre/construction-pm`, then `npm install`, then `npm run dev`
4. Open **http://localhost:3000**

---

## If something doesn’t work

- **App shows “Missing Supabase env vars”:** Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel (and in **.env.local** for local), then redeploy.
- **Login/Sign up do nothing:** In Supabase, check **Authentication** → **Providers** → **Email** is enabled.
- **Tasks page errors:** Make sure you ran the full SQL from `supabase/migrations/001_create_tasks.sql` in the Supabase SQL Editor.
- **Sentry not receiving events:** Confirm all four Sentry env vars are set in Vercel and that you redeployed after adding them.

If you’re stuck, say which step you’re on and what you see on the screen (or any error message), and we can fix it step by step.
