import { test, expect } from "./fixtures";

// Helper to find a task by title (titles are rendered as input defaultValues)
function taskByTitle(page: import("@playwright/test").Page, title: string) {
  return page.locator(`input[value="${title}"]`);
}

// Helper: create a task and open its detail panel
async function createTaskAndOpenDetail(page: import("@playwright/test").Page, title: string) {
  const taskInput = page.getByPlaceholder("Add task");
  await taskInput.fill(title);
  await taskInput.press("Enter");
  await expect(taskByTitle(page, title)).toBeVisible();

  // Click the task row to open the detail panel
  const taskRow = page
    .locator("div.group.cursor-pointer")
    .filter({ has: taskByTitle(page, title) });
  await taskRow.click();
  await expect(page).toHaveURL(/[?&]task=/);

  // Wait for the detail panel to be ready (notes textarea is a reliable indicator)
  await expect(page.getByPlaceholder("Add a note")).toBeVisible();
}

// Helper: wait for a specific GraphQL mutation response
function waitForMutation(page: import("@playwright/test").Page, mutationName: string) {
  return page.waitForResponse(async (resp) => {
    if (!resp.url().includes("/graphql") || resp.request().method() !== "POST") return false;
    try {
      const body = resp.request().postDataJSON();
      return body?.query?.includes(mutationName) ?? false;
    } catch {
      return false;
    }
  });
}

test.describe("Tags", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
    await page.waitForURL("**/lists/**");
  });

  test("creates a tag from task detail and verifies it appears on the task", async ({ page }) => {
    const taskTitle = `TagCreate ${Date.now()}`;
    const tagName = `tag-${Date.now()}`;

    await createTaskAndOpenDetail(page, taskTitle);

    // Click the "Add tag" button to open the tag popover
    await page.getByRole("button", { name: "Add tag" }).click();

    // The tag command popover should be visible with a search input
    const tagSearchInput = page.getByPlaceholder("Search or create tag...");
    await expect(tagSearchInput).toBeVisible();

    // Type a new tag name
    await tagSearchInput.fill(tagName);

    // Since no tag exists with this name, the "Create" option should appear
    const createTagButton = page.getByText(`Create "${tagName}"`);
    await expect(createTagButton).toBeVisible();

    // Click to create and assign the tag
    const createTagMutation = waitForMutation(page, "createTag");
    const addTagMutation = waitForMutation(page, "addTagToTask");
    await createTagButton.click();
    await createTagMutation;
    await addTagMutation;

    // The tag should now appear as a badge in the detail panel
    const detailPanel = page.locator("div.border-l").first();
    await expect(detailPanel.locator("span", { hasText: tagName })).toBeVisible();

    // The tag should also appear on the task item in the list (as a small badge)
    const taskRow = page
      .locator("div.group.cursor-pointer")
      .filter({ has: taskByTitle(page, taskTitle) });
    await expect(taskRow.locator("span", { hasText: tagName })).toBeVisible();
  });

  test("assigns an existing tag to another task", async ({ page }) => {
    const firstTaskTitle = `TagFirst ${Date.now()}`;
    const secondTaskTitle = `TagSecond ${Date.now()}`;
    const tagName = `existing-${Date.now()}`;

    // Create the first task and add a new tag to it
    await createTaskAndOpenDetail(page, firstTaskTitle);
    await page.getByRole("button", { name: "Add tag" }).click();
    const tagSearchInput = page.getByPlaceholder("Search or create tag...");
    await tagSearchInput.fill(tagName);
    const createTagMutation = waitForMutation(page, "createTag");
    const addTagMutation = waitForMutation(page, "addTagToTask");
    await page.getByText(`Create "${tagName}"`).click();
    await createTagMutation;
    await addTagMutation;

    // Verify tag is on the first task detail
    const detailPanel = page.locator("div.border-l").first();
    await expect(detailPanel.locator("span", { hasText: tagName })).toBeVisible();

    // Close the detail panel
    const closeButton = detailPanel.locator("button").first();
    await closeButton.click();
    await expect(page).not.toHaveURL(/[?&]task=/);

    // Create a second task and open its detail
    await createTaskAndOpenDetail(page, secondTaskTitle);

    // Open the tag popover
    await page.getByRole("button", { name: "Add tag" }).click();
    await expect(page.getByPlaceholder("Search or create tag...")).toBeVisible();

    // The previously created tag should appear in the list -- select it
    const existingTagOption = page.locator("[cmdk-item]", { hasText: tagName });
    await expect(existingTagOption).toBeVisible();

    const assignMutation = waitForMutation(page, "addTagToTask");
    await existingTagOption.click();
    await assignMutation;

    // Verify tag is now on the second task detail
    const detailPanel2 = page.locator("div.border-l").first();
    await expect(detailPanel2.locator("span", { hasText: tagName })).toBeVisible();
  });

  test("removes a tag from a task", async ({ page }) => {
    const taskTitle = `TagRemove ${Date.now()}`;
    const tagName = `removable-${Date.now()}`;

    // Create task and add a tag
    await createTaskAndOpenDetail(page, taskTitle);
    await page.getByRole("button", { name: "Add tag" }).click();
    const tagSearchInput = page.getByPlaceholder("Search or create tag...");
    await tagSearchInput.fill(tagName);
    const createMutation = waitForMutation(page, "createTag");
    const addMutation = waitForMutation(page, "addTagToTask");
    await page.getByText(`Create "${tagName}"`).click();
    await createMutation;
    await addMutation;

    // Verify the tag badge is visible in the detail panel
    const detailPanel = page.locator("div.border-l").first();
    const tagBadge = detailPanel.locator("span", { hasText: tagName }).first();
    await expect(tagBadge).toBeVisible();

    // Click the X button inside the tag badge to remove it
    // The badge structure is: <Badge>tagName <button><X /></button></Badge>
    const removeMutation = waitForMutation(page, "removeTagFromTask");
    const removeButton = tagBadge.locator("xpath=..").locator("button");
    await removeButton.click();
    await removeMutation;

    // The tag badge should no longer be visible in the detail panel
    await expect(detailPanel.locator("span", { hasText: tagName })).not.toBeVisible();
  });

  test("navigates to tag page via sidebar", async ({ page }) => {
    const taskTitle = `TagNav ${Date.now()}`;
    const tagName = `navtag-${Date.now()}`;

    // Create task and add a tag so it appears in the sidebar
    await createTaskAndOpenDetail(page, taskTitle);
    await page.getByRole("button", { name: "Add tag" }).click();
    const tagSearchInput = page.getByPlaceholder("Search or create tag...");
    await tagSearchInput.fill(tagName);
    const createMutation = waitForMutation(page, "createTag");
    const addMutation = waitForMutation(page, "addTagToTask");
    await page.getByText(`Create "${tagName}"`).click();
    await createMutation;
    await addMutation;

    // The tag should now appear in the sidebar navigation
    const sidebar = page.locator("aside");
    const sidebarTagLink = sidebar.locator("a", { hasText: tagName });
    await expect(sidebarTagLink).toBeVisible();

    // Click on the tag in the sidebar to navigate to the tag page
    await sidebarTagLink.click();
    await expect(page).toHaveURL(/\/tags\//);

    // The tag page should show the tag name as a heading input
    const tagPageHeading = page.locator("input.text-2xl");
    await expect(tagPageHeading).toHaveValue(tagName);

    // The task we tagged should be listed on the tag page
    await expect(taskByTitle(page, taskTitle)).toBeVisible();
  });
});
