import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("has email and password fields and submit button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /log in/i })
    ).toBeVisible();
  });

  test("links to sign up", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /sign up/i }).click();
    await expect(page).toHaveURL("/signup");
  });
});

test.describe("Sign up page", () => {
  test("has email and password fields and submit button", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign up/i })
    ).toBeVisible();
  });

  test("links to login", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("link", { name: /log in/i }).click();
    await expect(page).toHaveURL("/login");
  });
});
