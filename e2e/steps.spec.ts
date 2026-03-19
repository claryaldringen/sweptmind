import { test, expect } from "./fixtures";

// Helper to find a task by title (titles are rendered as input defaultValues)
function taskByTitle(page: import("@playwright/test").Page, title: string) {
  return page.locator(`input[value="${title}"]`);
}

test.describe("Steps CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
    await page.waitForURL("**/lists/**");
  });

  /**
   * Helper: creates a task and opens its detail panel.
   * Returns the task title for later assertions.
   */
  async function createTaskAndOpenDetail(page: import("@playwright/test").Page) {
    const taskTitle = `Step test ${Date.now()}`;
    const taskInput = page.getByPlaceholder("Add task");
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");
    await expect(taskByTitle(page, taskTitle)).toBeVisible();

    // Click the task row to open the detail panel
    const taskRow = page.locator("div.group.cursor-pointer").filter({
      has: taskByTitle(page, taskTitle),
    });
    await taskRow.click();
    await expect(page).toHaveURL(/[?&]task=/);

    // Wait for the detail panel to load (notes textarea is a reliable indicator)
    await expect(page.getByPlaceholder("Add a note")).toBeVisible();

    return taskTitle;
  }

  /**
   * Helper: adds a step via the "Add step" input in the detail panel.
   * Returns the step title.
   */
  async function addStep(page: import("@playwright/test").Page, stepTitle?: string) {
    const title = stepTitle ?? `Step ${Date.now()}`;
    const stepInput = page.getByPlaceholder("Add step");
    await stepInput.fill(title);
    await stepInput.press("Enter");

    // Wait for the step to appear as an input with the step title
    await expect(page.locator(`input[value="${title}"]`)).toBeVisible();

    return title;
  }

  test("adds a step to a task", async ({ page }) => {
    await createTaskAndOpenDetail(page);

    const stepTitle = `New step ${Date.now()}`;
    const stepInput = page.getByPlaceholder("Add step");
    await expect(stepInput).toBeVisible();

    await stepInput.fill(stepTitle);
    await stepInput.press("Enter");

    // The step should appear as an input with the step title value
    await expect(page.locator(`input[value="${stepTitle}"]`)).toBeVisible();

    // The step input should be cleared after adding
    await expect(stepInput).toHaveValue("");
  });

  test("toggles step completion", async ({ page }) => {
    await createTaskAndOpenDetail(page);
    const stepTitle = await addStep(page);

    // Find the step row: it contains an input with the step title
    // Steps are in div.group containers with a checkbox
    const stepRow = page
      .locator("div.group")
      .filter({ has: page.locator(`input[value="${stepTitle}"]`) })
      .first();

    // Click the step's checkbox to mark it as completed
    const checkbox = stepRow.getByRole("checkbox");
    await checkbox.click();

    // The step input should get the line-through style (via the "line-through" class)
    const stepTitleInput = stepRow.locator(`input[value="${stepTitle}"]`);
    await expect(stepTitleInput).toHaveClass(/line-through/);

    // Click the checkbox again to un-complete
    await checkbox.click();
    await expect(stepTitleInput).not.toHaveClass(/line-through/);
  });

  test("deletes a step", async ({ page }) => {
    await createTaskAndOpenDetail(page);
    const stepTitle = await addStep(page);

    // Find the step row
    const stepRow = page
      .locator("div.group")
      .filter({ has: page.locator(`input[value="${stepTitle}"]`) })
      .first();

    // The delete button is hidden (opacity-0) and shown on hover (group-hover:opacity-100)
    // Hover over the step row to reveal it
    await stepRow.hover();

    // Click the delete button (the X icon button inside the step row)
    const deleteButton = stepRow.getByRole("button");
    await deleteButton.click();

    // The step should no longer be visible
    await expect(page.locator(`input[value="${stepTitle}"]`)).not.toBeVisible();
  });
});
