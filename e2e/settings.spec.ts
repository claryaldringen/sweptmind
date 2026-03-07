import { test, expect } from "./fixtures";

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
  });

  test("switches language to Czech and back", async ({ page }) => {
    // Page should show English content initially
    await expect(page.getByText("Appearance")).toBeVisible();

    // Click Czech language button
    await page.getByRole("button", { name: "Čeština" }).click();

    // UI should update to Czech — "Appearance" becomes "Vzhled"
    await expect(page.getByText("Vzhled")).toBeVisible();

    // Switch back to English
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByText("Appearance")).toBeVisible();
  });

  test("switches theme to dark and light", async ({ page }) => {
    // Click Dark theme
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    // Click Light theme
    await page.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
