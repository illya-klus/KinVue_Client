import { expect, test } from "@playwright/test";

const api = "http://localhost:4000/api";

test("registration sends normalized identity fields and returns to sign in", async ({
  page,
}) => {
  let registrationBody: Record<string, unknown> | null = null;

  await page.route(api + "/auth/refresh", (route) =>
    route.fulfill({ status: 401, json: { message: "No session" } }),
  );
  await page.route(api + "/auth/register", async (route) => {
    expect(route.request().method()).toBe("POST");
    registrationBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, json: { status: "PENDING" } });
  });

  await page.goto("/register");
  await page.getByLabel("Email").fill("alice@example.test");
  await page.getByLabel("Username").fill(" Alice_1 ");
  await page.getByLabel("Display name").fill(" Alice Example ");
  await page.getByLabel("Password (min 12)").fill("long-password-123");
  await page.getByLabel("Confirm password").fill("long-password-123");
  await page.getByRole("button", { name: "Register" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect(registrationBody).toEqual({
    email: "alice@example.test",
    username: "alice_1",
    displayName: "Alice Example",
    password: "long-password-123",
  });
});
