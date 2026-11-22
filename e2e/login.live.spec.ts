import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const liveStack = process.env.E2E_STACK === "1";

test.describe("Live password login through Gateway (KIN-250)", () => {
  test.skip(
    !liveStack,
    "Run with pnpm test:e2e:full against the disposable live stack",
  );

  test("restores an authenticated session and lands on movie search", async ({
    page,
    context,
  }) => {
    const id = randomUUID().replaceAll("-", "").slice(0, 16);
    const email = `kinvue-login-${id}@example.test`;
    const username = `login_${id}`;
    const password = `E2e-password-${id}-!`;

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Display name").fill("KinVue Login User");
    await page.getByLabel("Password (min 12)").fill(password);
    await page.getByLabel("Confirm password").fill(password);
    const registration = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/register") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Register" }).click();
    expect((await registration).status()).toBe(201);
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/movies\/search$/);
    await expect(
      page.getByRole("heading", { name: "Movie search" }),
    ).toBeVisible();

    const refreshCookie = (await context.cookies()).find(
      (cookie) => cookie.name === "kinvue_refresh",
    );
    expect(refreshCookie?.httpOnly).toBe(true);
    expect(refreshCookie?.path).toBe("/api/auth");
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("kinvue.accessToken")),
      )
      .toBeNull();
  });
});
