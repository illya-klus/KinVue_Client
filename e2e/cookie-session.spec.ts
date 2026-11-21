import { expect, test } from "@playwright/test";
const api = "http://localhost:4000/api";
test("cookie session restores after reload, shares 401 refresh, and logs out", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "kinvue_refresh",
      value: "test-cookie",
      domain: "localhost",
      path: "/api/auth",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.addInitScript(() => {
    sessionStorage.setItem("kinvue.refreshToken", "legacy-refresh");
    localStorage.setItem("kinvue.accessToken", "legacy-access");
  });
  let refreshes = 0,
    logout = false;
  await page.route(api + "/auth/refresh", (route) => {
    refreshes++;
    expect(route.request().postData()).toBeNull();
    expect(route.request().headers().cookie).toContain(
      "kinvue_refresh=test-cookie",
    );
    return route.fulfill({
      json: {
        accessToken: refreshes === 1 ? "expired-access" : "fresh-access",
      },
    });
  });
  await page.route(api + "/notifications**", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  for (const path of [
    "/friends?**",
    "/friend-requests/incoming?**",
    "/friend-requests/outgoing?**",
  ]) {
    await page.route(api + path, (route) =>
      route.fulfill(
        route.request().headers().authorization === "Bearer fresh-access"
          ? { json: { items: [], nextCursor: null } }
          : { status: 401, json: { message: "Expired" } },
      ),
    );
  }
  await page.route(api + "/auth/logout", (route) => {
    expect(route.request().headers().cookie).toContain(
      "kinvue_refresh=test-cookie",
    );
    logout = true;
    return route.fulfill({
      status: 204,
      headers: {
        "set-cookie":
          "kinvue_refresh=; Path=/api/auth; Max-Age=0; HttpOnly; SameSite=Strict",
      },
    });
  });
  await page.goto("/friends");
  await expect(page.getByText("No friends yet")).toBeVisible();
  expect(refreshes).toBe(2);
  await page.reload();
  await expect(page.getByText("No friends yet")).toBeVisible();
  expect(refreshes).toBe(3);
  expect(
    await page.evaluate(() => ({
      session: sessionStorage.getItem("kinvue.refreshToken"),
      access: localStorage.getItem("kinvue.accessToken"),
      readable: document.cookie,
    })),
  ).toEqual({ session: null, access: null, readable: "" });
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(logout).toBe(true);
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === "kinvue_refresh",
    ),
  ).toBe(false);
});
