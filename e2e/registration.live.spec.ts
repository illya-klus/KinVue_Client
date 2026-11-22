import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const liveStack = process.env.E2E_STACK === "1";

test.describe("Live registration through Gateway (KIN-247)", () => {
  test.skip(
    !liveStack,
    "Run with pnpm test:e2e:full against the disposable live stack",
  );

  test("creates an ACTIVE identity and profile that can sign in", async ({
    page,
  }) => {
    const id = randomUUID().replaceAll("-", "").slice(0, 16);
    const email = `kinvue-e2e-${id}@example.test`;
    const username = `e2e_${id}`;
    const password = `E2e-password-${id}-!`;

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Username").fill(` ${username.toUpperCase()} `);
    await page.getByLabel("Display name").fill(" KinVue E2E User ");
    await page.getByLabel("Password (min 12)").fill(password);
    await page.getByLabel("Confirm password").fill(password);

    const registration = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/register") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Register" }).click();
    const registered = await registration;
    expect(registered.status()).toBe(201);
    expect(await registered.json()).toMatchObject({ status: "ACTIVE" });
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/movies\/search$/);

    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: "Your profile" }),
    ).toBeVisible();
    await expect(page.getByText(`@${username}`)).toBeVisible();
    await expect(page.getByLabel("Display name")).toHaveValue(
      "KinVue E2E User",
    );
  });
});
