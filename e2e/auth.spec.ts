import { test, expect } from "@playwright/test";

// Auth tests run WITHOUT the authenticated storageState
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Auth flow", () => {
  test("redirects unauthenticated user to login", async ({ page }) => {
    await page.goto("/planned");
    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("logs in with valid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.locator("input#email").fill("test@example.com");
    await page.locator("input#password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    // After login, redirects to /planned
    await page.waitForURL("**/planned");
    await expect(page.getByRole("heading", { name: "Planned" })).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.locator("input#email").fill("wrong@example.com");
    await page.locator("input#password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByText("Invalid email or password"),
    ).toBeVisible();
  });

  test("registers a new user", async ({ page }) => {
    await page.goto("/register");

    const uniqueEmail = `e2e-${Date.now()}@example.com`;
    await page.locator("input#name").fill("E2E Test");
    await page.locator("input#email").fill(uniqueEmail);
    await page.locator("input#password").fill("password123");
    await page.getByRole("button", { name: "Create an account" }).click();

    // After registration, redirects to /planned
    await page.waitForURL("**/planned");
  });
});
