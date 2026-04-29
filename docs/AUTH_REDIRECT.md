# Fix "requested path is invalid" for email confirmation

This error means Supabase is redirecting to a URL that is **not** in your Redirect URLs list. Do the following once.

## 1. Get your app URL

- **Production:** Your Vercel URL, e.g. `https://construction-pm-xxxx.vercel.app` (no trailing slash).
- **Local:** `http://localhost:3000` when testing on your machine.

## 2. Configure Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **URL Configuration**.
3. Set **Site URL** to your app URL:
   - Production: `https://your-app.vercel.app`
   - Local only: `http://localhost:3000`
4. Under **Redirect URLs**, add these **exact** URLs (one per line):
   - `https://your-app.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (for local testing)
   - If you use Vercel preview deployments: `https://*.vercel.app/auth/callback`
5. Click **Save**.

## 3. Important

- Use your **real** Vercel URL, not `your-app.vercel.app`.
- No trailing slash: use `https://xxx.vercel.app/auth/callback`, not `https://xxx.vercel.app/auth/callback/`.
- After changing Redirect URLs, **new** confirmation emails will use the new URL. Old emails may still point at the old one; use "Resend confirmation" or sign up again to get a new link.

## 4. Test

1. Sign up with a new email (or use "Resend confirmation" for an existing one).
2. Open the confirmation link from the email.
3. You should hit `/auth/callback` first; the app supports both **`?code=`** (PKCE, needs the same browser context as sign-up for the verifier) and **`?token_hash=&type=signup`** (works when opening the link from Gmail / another device). You should end on `/login?verified=1` after email confirmation.

If you only ever see **`?code=`** and confirmation fails when opening from the email app, check your **Auth → Email** templates against [Supabase’s SSR password guide](https://supabase.com/docs/guides/auth/passwords) — the `token_hash` style redirect avoids PKCE’s cross-browser limitation.
