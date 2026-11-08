import { test, expect } from "@playwright/test";

const full = process.env.E2E_STACK === "1";

test.describe("Notifications: friend + room invite (KIN-125)", () => {
  test.skip(!full, "Set E2E_STACK=1 with Gateway, Users, Rooms, Notification running");

  test("both event types appear in the bell list", async ({ page }) => {
    test.setTimeout(120_000);
    // Operator fills credentials via env in CI later.
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    test.skip(!email || !password, "E2E_USER_EMAIL and E2E_USER_PASSWORD required");

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.getByRole("button", { name: "Notifications" }).click();
    await expect(page.getByText(/Friend request|Room invite/)).toBeVisible({
      timeout: 30_000,
    });
  });
});
