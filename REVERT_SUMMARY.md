# Revert Summary: Restore to Production Behavior

## Git context

- **Current branch:** `main` (up to date with `origin/main`)
- **Latest commit:** `20c9b58` — Fix orat_projects RLS: create project via RPC, add INSERT/DELETE policies in 003
- **No production tag or branch** exists in the repo; comparison was done using git history from `8a4a06d` through `20c9b58`.

## Offending commits / files

| Source | What changed | Why it caused breakage |
|--------|--------------|-------------------------|
| **Commit `8a4a06d`** (Make ORAT the main app) | `src/app/page.tsx`: added "Open app" link, `text-primary-600`, `dark:hover:bg-primary-950` | **Open app:** Lets unauthenticated users reach `/orat` from the landing page (bad for production). **primary-950:** Not defined in `tailwind.config.ts` (only 50–900), so dark hover did nothing and reliance on custom primary made styling fragile. |
| **Base styles** | `src/app/globals.css`: root/body outside `@layer base`, no explicit body font/line-height | In some environments or build/cache cases, base styles can fail to apply, so the app can look like raw HTML (no font, no colors). |

No other commits between `8a4a06d` and `20c9b58` changed `page.tsx` or `globals.css`. The RLS/actions/migrations commits (`4d62938`, `db76470`, `20c9b58`) did not touch layout or global CSS.

## Exact fixes made

1. **`src/app/page.tsx`**
   - Removed the **"Open app"** link and its `Link` so the landing page only offers **Log in** and **Sign up** (production-aligned: require auth to reach the app).
   - Replaced custom `primary-*` with **slate** and valid Tailwind classes so the page does not depend on undefined `primary-950` and renders consistently.
   - Title: `text-primary-600` → `text-slate-900 dark:text-white`.
   - Buttons: explicit slate borders/backgrounds and hover states (no `primary-950`).

2. **`src/app/globals.css`**
   - Wrapped `:root` and `body` in **`@layer base`** so Tailwind’s base layer applies correctly.
   - Set **`body`** to: `margin: 0`, `font-family` (system UI stack), `line-height: 1.5`.
   - Added **`html { -webkit-text-size-adjust: 100%; }`** for more consistent rendering.

No other files were changed. No RLS, actions, or migration code was reverted.

## What still needs manual verification

1. **CSS loading**  
   In the browser: DevTools → Network → reload. Confirm a CSS file (e.g. from `_app` or a chunk) loads with status 200. If CSS still doesn’t load, the problem is environment/build/cache, not these edits.

2. **Landing page behavior**  
   - Only **Log in** and **Sign up** are visible; **Open app** is gone.  
   - Unauthenticated users should reach `/orat` only after logging in (middleware redirects unauthenticated `/orat` to `/login`).

3. **Production deploy**  
   Deploy this branch and confirm the deployed app matches the above (no Open app, styled landing page, auth required for ORAT). If your “production” is a specific Vercel deploy or commit, tag that in git (e.g. `git tag production <commit>`) so future comparisons are unambiguous.

4. **Optional**  
   If you later add a `production` branch or tag, run:  
   `git diff production -- src/app/page.tsx src/app/globals.css`  
   to confirm no unintended drift from production.
