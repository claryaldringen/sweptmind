import { test, expect } from "./fixtures";

test.describe("Nearby page", () => {
  test("navigates to nearby page via sidebar link", async ({ page }) => {
    await page.goto("/tasks");
    await page.waitForURL("**/lists/**");

    // Click the "Nearby" link in the sidebar
    await page.getByRole("link", { name: "Nearby" }).click();
    await expect(page).toHaveURL("/nearby");

    await expect(page.getByRole("heading", { name: "Nearby" })).toBeVisible();
  });

  test("shows page heading when navigating directly", async ({ page }) => {
    await page.goto("/nearby");

    await expect(page.getByRole("heading", { name: "Nearby" })).toBeVisible();
  });

  test("handles missing geolocation permission gracefully", async ({ page }) => {
    // Playwright does not grant geolocation by default.
    // The page auto-calls startTracking(), which triggers watchPosition.
    // Without permission the error callback fires, leading to either:
    //   a) IP-based fallback succeeds  -> "5 km radius" text + empty nearby list
    //   b) IP-based fallback fails     -> "Enable location tracking" button shown
    // Both are valid outcomes; we verify the page does not crash and shows
    // meaningful UI in either case.
    await page.goto("/nearby");
    await page.waitForLoadState("networkidle");

    // The heading must always be visible regardless of geolocation state
    await expect(page.getByRole("heading", { name: "Nearby" })).toBeVisible();

    // One of these outcomes must be present:
    //  - "Enable location tracking" button (no position at all)
    //  - "5 km radius" text (tracking active with or without results)
    const enableButton = page.getByRole("button", { name: "Enable location tracking" });
    const radiusText = page.getByText("5 km radius");

    await expect(enableButton.or(radiusText)).toBeVisible();
  });
});
