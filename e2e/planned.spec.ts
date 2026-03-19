import { test, expect } from "./fixtures";

test.describe("Planned view", () => {
  test("navigates to planned page and shows heading", async ({ page }) => {
    await page.goto("/planned");

    await expect(
      page.getByRole("heading", { name: "Planned" }),
    ).toBeVisible();
  });

  test("shows grouped task sections or empty state", async ({ page }) => {
    await page.goto("/planned");

    // Wait for the page to finish loading data
    await page.waitForLoadState("networkidle");

    // The planned page shows either time-based groups or an empty state
    const groupHeaders = page.locator("h2");
    const emptyState = page.getByText("No planned tasks");

    // Either some group headers exist or the empty state is shown
    const groupCount = await groupHeaders.count();
    const emptyCount = await emptyState.count();

    expect(groupCount + emptyCount).toBeGreaterThan(0);
  });

  test("displays task with due date", async ({ page }) => {
    // First go to default list and create a task with a due date
    await page.goto("/tasks");
    await page.waitForURL("**/lists/**");

    const taskTitle = `Planned E2E ${Date.now()}`;
    const taskInput = page.getByPlaceholder("Add task");
    await taskInput.fill(taskTitle);
    await taskInput.press("Enter");
    await expect(page.locator(`input[value="${taskTitle}"]`)).toBeVisible();

    // Open task detail to set a due date
    const taskRow = page.locator("div.group.cursor-pointer").filter({
      has: page.locator(`input[value="${taskTitle}"]`),
    });
    await taskRow.click();
    await expect(page).toHaveURL(/[?&]task=/);

    // Set due date to Today
    await page.getByRole("button", { name: "Add due date" }).click();
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByRole("button", { name: /Due / })).toBeVisible();

    // Navigate to planned page
    await page.goto("/planned");

    // The task should be visible in the planned view under "Today" section
    await expect(page.locator(`input[value="${taskTitle}"]`)).toBeVisible();
  });
});
