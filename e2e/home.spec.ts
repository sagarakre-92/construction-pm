import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("shows app title and auth links", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /owner.?s rep action tracker/i })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /log in/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /sign up/i })).toBeVisible();
  });

  test("navigates to login from home", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /log in/i }).click();
    await expect(page).toHaveURL("/login");
    await expect(
      page.getByRole("heading", { name: /log in/i })
    ).toBeVisible();
  });

  test("navigates to sign up from home", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /sign up/i }).click();
    await expect(page).toHaveURL("/signup");
    await expect(
      page.getByRole("heading", { name: /sign up/i })
    ).toBeVisible();
  });
});
