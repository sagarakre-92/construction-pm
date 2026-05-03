import { test, expect } from "@playwright/test";

test.describe("Organization invitation landing", () => {
  test("shows an error for a non-existent invite token", async ({ page }) => {
    const fakeToken = "a".repeat(64);
    await page.goto(`/invite/${fakeToken}`);
    await expect(
      page.getByText(/no longer valid|Invitation not found|Invalid invitation/i),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("invalid invite still offers log in for guests", async ({ page }) => {
    const fakeToken = "b".repeat(64);
    await page.goto(`/invite/${fakeToken}`);
    await expect(page.getByRole("link", { name: /^log in$/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("Login invite handoff", () => {
  test("sign up link preserves internal redirect for invite flow", async ({ page }) => {
    const invitePath = "/invite/test-token-handoff";
    await page.goto(
      `/login?redirect=${encodeURIComponent(invitePath)}`,
    );
    const signUp = page.getByRole("link", { name: /sign up/i });
    const href = await signUp.getAttribute("href");
    expect(href).toMatch(/^\/signup\?/);
    expect(href).toContain("next=");
    expect(decodeURIComponent(href ?? "")).toContain(invitePath);
  });
});
