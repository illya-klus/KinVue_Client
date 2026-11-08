import { test, expect } from "@playwright/test";

/**
 * Phase 29 journey placeholders — expand when full stack is wired in CI.
 */
const journeys = [
  "register user",
  "login user",
  "edit profile",
  "user search",
  "friend request and accept",
  "admin creates and publishes movie",
  "user searches movie",
  "watchlist",
  "notification friend + room invite",
];

for (const name of journeys) {
  test(`journey: ${name}`, async ({ page }) => {
    if (process.env.E2E_STACK !== "1") {
      test.skip();
    }
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "KinVue" })).toBeVisible();
  });
}
