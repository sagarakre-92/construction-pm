---
name: write-e2e-test
description: Write a Playwright end-to-end test for the ORAT Next.js app following this repo's conventions (semantic queries, auth-aware specs, no CSS selectors). Use when the user asks to add an E2E test, Playwright test, or browser test for the construction-pm project.
---

# Write a Playwright E2E test

E2E specs live in `e2e/` and run via `npm run test:e2e`. The Playwright
config (`playwright.config.ts`) auto-starts the dev server before tests,
so you don't need to manage that.

## Workflow

```
- [ ] 1. Decide the user flow (one cohesive scenario per file)
- [ ] 2. Create e2e/<name>.spec.ts (mirror auth.spec.ts shape)
- [ ] 3. Use semantic queries: getByRole / getByLabel / getByText
- [ ] 4. Avoid CSS selectors and getByTestId unless absolutely necessary
- [ ] 5. If the flow needs auth, set up a logged-in session at the top
- [ ] 6. Run `npm run test:e2e` (headless) and `npm run test:e2e:ui` to debug
```

## File template

```typescript
import { test, expect } from "@playwright/test";

test.describe("<Feature> page", () => {
  test("<observable behavior>", async ({ page }) => {
    await page.goto("/route");

    await expect(page.getByRole("heading", { name: /expected title/i })).toBeVisible();

    await page.getByLabel(/email/i).fill("user@example.com");
    await page.getByRole("button", { name: /submit/i }).click();

    await expect(page).toHaveURL(/\/expected-destination/);
  });
});
```

See `e2e/auth.spec.ts`, `e2e/dashboard.spec.ts`, `e2e/home.spec.ts` for
working examples.

## Locator priority (use the highest one that works)

1. `getByRole("button", { name: /…/i })` — preferred for buttons, links,
   headings, form fields with proper labels.
2. `getByLabel(/…/i)` — for form inputs.
3. `getByText(/…/i)` — for arbitrary text content.
4. `getByPlaceholder(/…/i)` — only when no label exists.
5. `getByTestId(...)` — last resort. Adding a `data-testid` to source code
   should be a deliberate, justified choice.

❌ **Never** use raw CSS selectors like `page.locator("div.task-card")` —
they are brittle.

## Auth-required flows

`/orat/*` requires login. Two options:

**Option A — programmatic auth** (preferred for fast tests).
Sign in via the Supabase API at the start of the test, set the session
cookie, then visit the protected page. (No helper exists yet — if you build
one, put it in `e2e/helpers/auth.ts` and reuse it everywhere.)

**Option B — UI auth** (slow but realistic).
```typescript
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/orat/);
});
```

Requires `E2E_EMAIL` / `E2E_PASSWORD` env vars pointing to a real Supabase
test user.

## Assertions

- Prefer **web-first assertions** (`await expect(locator).toBeVisible()`)
  over manual `waitFor*` calls. They auto-retry.
- For URLs use `toHaveURL(/regex/)` rather than exact strings — search params
  vary.
- For dynamic lists, use `toHaveCount()` or filter by name.

## Running

```bash
npm run test:e2e          # headless, all specs
npm run test:e2e:ui       # interactive UI mode for debugging
npx playwright test e2e/auth.spec.ts          # one file
npx playwright test -g "links to sign up"     # by name
```

## Anti-patterns

- ❌ `page.waitForTimeout(2000)` — use web-first assertions instead.
- ❌ Hardcoded UUIDs / IDs from a specific Supabase instance.
- ❌ Tests that depend on the order of other tests (each test must be
  independent).
- ❌ Logging in via the UI in every test when programmatic auth is feasible.
- ❌ Asserting on Tailwind classnames (`expect(el).toHaveClass(...)`) —
  assert on user-visible behavior instead.
