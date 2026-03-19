import { test, expect } from "./fixtures";

test.describe("Task detail panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
    await page.waitForURL("**/lists/**");
  });

  test("opens detail panel and updates URL", async ({ page }) => {
    // Click on a task row to open the detail panel
    const taskItem = page.locator("div.group.cursor-pointer").first();
    await taskItem.click();

    // URL should contain ?task= parameter
    await expect(page).toHaveURL(/[?&]task=/);

    // Detail panel should be visible with notes textarea
    await expect(page.getByPlaceholder("Add a note")).toBeVisible();
  });

  test("closes detail panel and clears URL", async ({ page }) => {
    // Open a task detail
    const taskItem = page.locator("div.group.cursor-pointer").first();
    await taskItem.click();
    await expect(page).toHaveURL(/[?&]task=/);

    // Close the panel via X button in the detail panel (border-l container)
    const panel = page.locator("div.border-l").first();
    const closeButton = panel.locator("button").first();
    await closeButton.click();

    // URL should no longer have ?task=
    await expect(page).not.toHaveURL(/[?&]task=/);
  });

  test("adds a note to a task", async ({ page }) => {
    // Open task detail
    const taskItem = page.locator("div.group.cursor-pointer").first();
    await taskItem.click();
    await expect(page.getByPlaceholder("Add a note")).toBeVisible();

    const noteText = `E2E note ${Date.now()}`;
    const textarea = page.getByPlaceholder("Add a note");
    await textarea.fill(noteText);
    await textarea.blur();

    // Reload and verify the note persisted
    await page.reload();
    await expect(page).toHaveURL(/[?&]task=/);
    await expect(page.locator("textarea")).toHaveValue(noteText);
  });

  test("adds a due date to a task", async ({ page }) => {
    // Create a fresh task so we know it has no due date
    const taskInput = page.getByPlaceholder("Add task");
    const taskTitle = `DueDate ${Date.now()}`;
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");

    // Wait for task to appear as an input value
    await expect(page.locator(`input[value="${taskTitle}"]`)).toBeVisible();

    // Open its detail panel
    const taskRow = page.locator("div.group.cursor-pointer").filter({
      has: page.locator(`input[value="${taskTitle}"]`),
    });
    await taskRow.click();
    await expect(page).toHaveURL(/[?&]task=/);

    // Click "Add due date" button
    await page.getByRole("button", { name: "Add due date" }).click();

    // Click "Today" shortcut in the date picker
    await page.getByRole("button", { name: "Today", exact: true }).click();

    // Due date should now show on the button (it changes to "Due ...")
    await expect(page.getByRole("button", { name: /Due / })).toBeVisible();
  });
});
