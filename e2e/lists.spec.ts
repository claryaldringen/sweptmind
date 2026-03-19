import { test, expect } from "./fixtures";

test.describe("List management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/planned");
  });

  test("creates a new list", async ({ page }) => {
    const listName = `E2E List ${Date.now()}`;

    // Click "New list" button in sidebar
    await page.getByRole("button", { name: "New list" }).click();

    // Fill in the dialog
    await page.getByPlaceholder("List name").fill(listName);
    await page.getByRole("button", { name: "Create" }).click();

    // Should redirect to the new list and it should appear in sidebar
    await expect(page).toHaveURL(/\/lists\//);
    await expect(page.getByText(listName)).toBeVisible();
  });

  test("deletes a list with confirmation", async ({ page }) => {
    // First create a list to delete
    const listName = `Delete List ${Date.now()}`;
    await page.getByRole("button", { name: "New list" }).click();
    await page.getByPlaceholder("List name").fill(listName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/lists\//);
    await expect(page.getByText(listName)).toBeVisible();

    // Open the list dropdown menu — it's the ghost icon-size button with aria-haspopup
    const moreButton = page.locator('button[data-variant="ghost"][data-size="icon"][aria-haspopup="menu"]');
    await moreButton.click();

    // Click "Delete list" menuitem in the dropdown
    await page.getByRole("menuitem", { name: "Delete list" }).click();

    // Confirmation dialog
    await expect(page.getByText("Are you sure?")).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    // List should be gone from sidebar
    await expect(page.getByRole("link", { name: listName })).not.toBeVisible();
  });
});
