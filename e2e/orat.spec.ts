/**
 * End-to-end coverage for the core /orat dashboard flow:
 *   1. Programmatic login as the test user (cookies seeded by `loginAs`).
 *   2. Create a project (with at least one internal team member so newly
 *      created tasks have a valid assignee).
 *   3. Create a task inside that project.
 *   4. Drag the task card from "Not Started" → "In Progress" on the Kanban
 *      board (KanbanView wires native HTML5 drag-and-drop via
 *      `dataTransfer.setData/getData`; Playwright's `dragTo` dispatches the
 *      matching dragstart/dragover/drop sequence).
 *   5. Reload the page and confirm the task is still in "In Progress" — this
 *      is what proves the move was actually persisted by the server action.
 *
 * The whole suite is `test.skip`'d when the Supabase + test-user env vars
 * required by `loginAs` aren't set, so CI without those secrets stays green.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import { hasTestCredentials, loginAs } from "./helpers";

test.skip(
  !hasTestCredentials(),
  "ORAT spec requires TEST_USER_EMAIL/TEST_USER_PASSWORD + Supabase env",
);

/**
 * Locate a Kanban column by its header text. Each column in `KanbanView`
 * renders an `<h3>` heading inside a header `<div>` that is itself a child
 * of the column root. Walk two ancestors up from the heading to reach the
 * column root so subsequent queries (`getByText(taskTitle)`) can be scoped
 * to a single column.
 */
function kanbanColumn(page: Page, name: RegExp): Locator {
  return page.getByRole("heading", { name, level: 3 }).locator("xpath=../..");
}

test.describe("ORAT board flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto("/orat");
  });

  test("create project + task, drag to In Progress, persists across reload", async ({
    page,
  }) => {
    const stamp = Date.now();
    const projectName = `e2e-project-${stamp}`;
    const taskTitle = `e2e-task-${stamp}`;

    // Wait for the dashboard shell (sidebar) to render — the page has a
    // "Loading…" intermediate state while it fetches projects.
    const createProjectButton = page.getByRole("button", {
      name: /create project/i,
    });
    await expect(createProjectButton).toBeVisible({ timeout: 15_000 });

    // --- Create Project ----------------------------------------------------
    await createProjectButton.click();
    const projectDialog = page.getByRole("dialog", {
      name: /create project/i,
    });
    await expect(projectDialog).toBeVisible({ timeout: 10_000 });

    await projectDialog.getByLabel(/project name/i).fill(projectName);

    // Add the test user as an internal team member. Without at least one
    // selectable assignee, TaskDialog's Save button stays disabled because
    // it requires `assignedTo` to be a non-empty string.
    await projectDialog
      .getByRole("tab", { name: /team members/i })
      .click();
    const firstMember = projectDialog.getByRole("checkbox").first();
    await expect(firstMember).toBeVisible({ timeout: 10_000 });
    await firstMember.click();

    await projectDialog.getByRole("button", { name: /^save$/i }).click();
    await expect(projectDialog).toBeHidden({ timeout: 15_000 });

    // ORATPage auto-selects the newly created project; wait until the
    // header heading swaps from "All Projects" to the project name (silent
    // refetch finished).
    await expect(
      page.getByRole("heading", { name: projectName, level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    // --- Create Task (main app bar, left of Settings) ----------------------
    await page.getByRole("button", { name: /create task/i }).click();
    const taskDialog = page.getByRole("dialog", { name: /create task/i });
    await expect(taskDialog).toBeVisible({ timeout: 10_000 });

    // Title is the only field we need to fill: TaskDialog defaults Status
    // to "Not Started", Start/Due dates to today, and Assignee to the first
    // option (the team member we just added).
    await taskDialog.getByLabel(/^title/i).fill(taskTitle);
    await taskDialog.getByRole("button", { name: /^save$/i }).click();
    await expect(taskDialog).toBeHidden({ timeout: 15_000 });

    // --- Task lands in "Not Started" --------------------------------------
    const notStarted = kanbanColumn(page, /^not started$/i);
    const inProgress = kanbanColumn(page, /^in progress$/i);

    const cardInNotStarted = notStarted.getByText(taskTitle, { exact: true });
    await expect(cardInNotStarted).toBeVisible({ timeout: 15_000 });

    // --- Drag Not Started → In Progress -----------------------------------
    // KanbanView's drop handlers read `dataTransfer.getData("taskId")`. In
    // Chromium-based browsers, Playwright's `dragTo` correctly fires the
    // native HTML5 dnd event sequence (dragstart → dragover → drop) on
    // `draggable` elements, so we don't need manual mouse.down/move/up.
    await cardInNotStarted.dragTo(inProgress);

    const cardInProgress = inProgress.getByText(taskTitle, { exact: true });
    await expect(cardInProgress).toBeVisible({ timeout: 15_000 });
    await expect(
      notStarted.getByText(taskTitle, { exact: true }),
    ).toHaveCount(0);

    // The status change is optimistic locally but only persists once the
    // `updateTaskStatus` server action resolves. The success path fires a
    // `toast.success("Task updated")`; wait for it before reloading so we
    // don't race the network.
    await expect(
      page.getByText(/task updated/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    // --- Reload and re-assert ---------------------------------------------
    await page.reload();

    // After reload `ORATPage` resets to the "All Projects" view, which
    // still shows our task on the same Kanban board (filtered by status,
    // not project). Wait for the dashboard heading then assert the task is
    // in "In Progress" — proves the drag was actually saved server-side.
    await expect(
      page.getByRole("heading", { name: /all projects/i, level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    const inProgressAfterReload = kanbanColumn(page, /^in progress$/i);
    await expect(
      inProgressAfterReload.getByText(taskTitle, { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
