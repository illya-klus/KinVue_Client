import { expect, test } from "@playwright/test";

const api = "http://localhost:4000/api";

test("password login restores the signed-in state and keeps refresh in an HttpOnly cookie", async ({
  page,
  context,
}) => {
  let loginBody: Record<string, unknown> | null = null;

  await page.addInitScript(() => {
    sessionStorage.setItem("kinvue.refreshToken", "legacy-refresh");
    localStorage.setItem("kinvue.accessToken", "legacy-access");
  });
  await page.route(api + "/auth/refresh", (route) =>
    route.fulfill({ status: 401, json: { message: "No session" } }),
  );
  await page.route(api + "/auth/login", async (route) => {
    expect(route.request().method()).toBe("POST");
    loginBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      json: { accessToken: "password-login-access" },
      headers: {
        "set-cookie":
          "kinvue_refresh=rotated-cookie; Path=/api/auth; Max-Age=2592000; HttpOnly; SameSite=Strict",
      },
    });
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill("alice@example.test");
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/movies\/search$/);
  await expect(page.getByRole("heading", { name: "Movie search" })).toBeVisible();
  expect(loginBody).toEqual({
    email: "alice@example.test",
    password: "correct-horse-battery",
  });
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === "kinvue_refresh" && cookie.httpOnly,
    ),
  ).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        session: sessionStorage.getItem("kinvue.refreshToken"),
        access: localStorage.getItem("kinvue.accessToken"),
      })),
    )
    .toEqual({ session: null, access: null });
});
