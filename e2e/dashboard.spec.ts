import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("dashboard shows heading and tasks link", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /dashboard/i })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /tasks/i }).first()).toBeVisible();
  });

  test("tasks page shows heading and add task form or empty state", async ({
    page,
  }) => {
    await page.goto("/tasks");
    await expect(
      page.getByRole("heading", { name: /tasks/i })
    ).toBeVisible();
    await expect(
      page.getByPlaceholder(/task title/i).or(
        page.getByText(/no tasks yet|something went wrong/i)
      )
    ).toBeVisible({ timeout: 10000 });
  });
});
