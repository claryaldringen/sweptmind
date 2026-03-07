import { test, expect } from "./fixtures";

// Helper to find a task by title (titles are rendered as input defaultValues)
function taskByTitle(page: import("@playwright/test").Page, title: string) {
  return page.locator(`input[value="${title}"]`);
}

test.describe("Task CRUD", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the default Tasks list via /tasks redirect
    await page.goto("/tasks");
    await page.waitForURL("**/lists/**");
  });

  test("creates a new task", async ({ page }) => {
    const taskInput = page.getByPlaceholder("Add task");
    const taskTitle = `E2E Task ${Date.now()}`;
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");

    // Task title appears as an input value in the list
    await expect(taskByTitle(page, taskTitle)).toBeVisible();
  });

  test("toggles task completion", async ({ page }) => {
    // Create a task to test with
    const taskInput = page.getByPlaceholder("Add task");
    const taskTitle = `Toggle ${Date.now()}`;
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");
    await expect(taskByTitle(page, taskTitle)).toBeVisible();

    // Find the task row and click its checkbox
    const groupRow = page.locator("div.group").filter({ has: taskByTitle(page, taskTitle) }).first();
    const checkbox = groupRow.getByRole("checkbox").first();
    await checkbox.click();

    // After toggling, task moves to collapsed "Completed" section
    // Verify the "Completed" section toggle appears
    await expect(page.getByText(/Completed \(/)).toBeVisible();

    // Task should no longer be in the active list
    await expect(taskByTitle(page, taskTitle)).not.toBeVisible();
  });

  test("deletes a task with confirmation", async ({ page }) => {
    // Create a task to delete
    const taskInput = page.getByPlaceholder("Add task");
    const taskTitle = `Delete me ${Date.now()}`;
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");
    await expect(taskByTitle(page, taskTitle)).toBeVisible();

    // Hover to reveal delete button, then click it
    const groupRow = page.locator("div.group").filter({ has: taskByTitle(page, taskTitle) }).first();
    await groupRow.hover();

    // Click the trash/delete button (last button in the row)
    const deleteButton = groupRow.getByRole("button").last();
    await deleteButton.click();

    // Confirmation dialog should appear
    await expect(page.getByText("Are you sure?")).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    // Task should be gone
    await expect(taskByTitle(page, taskTitle)).not.toBeVisible();
  });

  test("edits task title inline", async ({ page }) => {
    // Create a task to edit
    const taskInput = page.getByPlaceholder("Add task");
    const originalTitle = `Edit me ${Date.now()}`;
    await taskInput.fill(originalTitle);
    await taskInput.press("Enter");
    await expect(taskByTitle(page, originalTitle)).toBeVisible();

    // Focus the task title input and edit it
    const titleInput = taskByTitle(page, originalTitle);
    const newTitle = `${originalTitle} edited`;

    // Listen specifically for the UpdateTask mutation response
    const mutationPromise = page.waitForResponse(async (resp) => {
      if (!resp.url().includes("/graphql") || resp.request().method() !== "POST") return false;
      try {
        const body = resp.request().postDataJSON();
        return body?.query?.includes("updateTask") ?? false;
      } catch {
        return false;
      }
    });

    // Click to focus, clear and type new title, blur to save
    await titleInput.click();
    await titleInput.fill(newTitle);
    await titleInput.blur();

    // Wait for the update mutation to complete
    const response = await mutationPromise;
    const body = await response.json();

    // Verify mutation succeeded and returned the new title
    expect(body.errors).toBeUndefined();
    expect(body.data?.updateTask?.title).toBe(newTitle);
  });
});
