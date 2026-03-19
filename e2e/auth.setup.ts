import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.locator("input#email").fill("test@example.com");
  await page.locator("input#password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();

  // After login, app redirects to /planned
  await page.waitForURL("**/planned");
  await expect(page.getByRole("heading", { name: "Planned" })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
