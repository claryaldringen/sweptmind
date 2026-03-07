import { test, expect } from "./fixtures";

test.describe("Recurrence and Reminder", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
    await page.waitForURL("**/lists/**");
  });

  test("set daily recurrence on a task", async ({ page }) => {
    // Create a new task
    const taskTitle = `Recurrence Daily ${Date.now()}`;
    const taskInput = page.getByPlaceholder("Add task");
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");
    await expect(page.locator(`input[value="${taskTitle}"]`)).toBeVisible();

    // Open detail panel by clicking the task row
    const taskRow = page.locator("div.group.cursor-pointer").filter({
      has: page.locator(`input[value="${taskTitle}"]`),
    });
    await taskRow.click();
    await expect(page).toHaveURL(/[?&]task=/);

    // Click "Add recurrence" button in the detail panel
    await page.getByRole("button", { name: "Add recurrence" }).click();

    // Click "Daily" in the recurrence popover
    await page.getByRole("button", { name: "Daily" }).click();

    // The recurrence button should now show "Every day" instead of "Add recurrence"
    await expect(page.getByRole("button", { name: "Every day" })).toBeVisible();

    // The task item in the list should show the recurrence indicator (Repeat icon)
    // The Repeat icon is rendered inside the task row metadata when hasRecurrence is true
    const taskItemRow = page.locator("div.group.cursor-pointer").filter({
      has: page.locator(`input[value="${taskTitle}"]`),
    });
    // The recurrence indicator is an SVG (Repeat icon from lucide) inside the task metadata
    await expect(taskItemRow.locator("svg.lucide-repeat")).toBeVisible();
  });

  test("set reminder on a task with a due date", async ({ page }) => {
    // Create a new task
    const taskTitle = `Reminder ${Date.now()}`;
    const taskInput = page.getByPlaceholder("Add task");
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");
    await expect(page.locator(`input[value="${taskTitle}"]`)).toBeVisible();

    // Open detail panel
    const taskRow = page.locator("div.group.cursor-pointer").filter({
      has: page.locator(`input[value="${taskTitle}"]`),
    });
    await taskRow.click();
    await expect(page).toHaveURL(/[?&]task=/);

    // First set a due date (click "Add due date", then "Today")
    await page.getByRole("button", { name: "Add due date" }).click();
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByRole("button", { name: /Due / })).toBeVisible();

    // Now set a reminder (click "Add reminder", then "Today")
    await page.getByRole("button", { name: "Add reminder" }).click();
    await page.getByRole("button", { name: "Today", exact: true }).click();

    // The reminder button should now show "Reminder ..." instead of "Add reminder"
    await expect(page.getByRole("button", { name: /Reminder / })).toBeVisible();

    // The task item in the list should show the reminder indicator (Bell icon)
    const taskItemRow = page.locator("div.group.cursor-pointer").filter({
      has: page.locator(`input[value="${taskTitle}"]`),
    });
    await expect(taskItemRow.locator("svg.lucide-bell")).toBeVisible();
  });

  test("remove reminder from a task", async ({ page }) => {
    // Create a new task
    const taskTitle = `RemoveReminder ${Date.now()}`;
    const taskInput = page.getByPlaceholder("Add task");
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");
    await expect(page.locator(`input[value="${taskTitle}"]`)).toBeVisible();

    // Open detail panel
    const taskRow = page.locator("div.group.cursor-pointer").filter({
      has: page.locator(`input[value="${taskTitle}"]`),
    });
    await taskRow.click();
    await expect(page).toHaveURL(/[?&]task=/);

    // Set a reminder first (click "Add reminder", then "Today")
    await page.getByRole("button", { name: "Add reminder" }).click();
    await page.getByRole("button", { name: "Today", exact: true }).click();

    // Verify reminder is set
    await expect(page.getByRole("button", { name: /Reminder / })).toBeVisible();

    // Open the reminder picker again and click "Remove date" to clear it
    await page.getByRole("button", { name: /Reminder / }).click();
    await page.getByRole("button", { name: "Remove date" }).click();

    // The button should revert to "Add reminder"
    await expect(page.getByRole("button", { name: "Add reminder" })).toBeVisible();

    // The task item should no longer show the Bell icon
    const taskItemRow = page.locator("div.group.cursor-pointer").filter({
      has: page.locator(`input[value="${taskTitle}"]`),
    });
    await expect(taskItemRow.locator("svg.lucide-bell")).not.toBeVisible();
  });
});
