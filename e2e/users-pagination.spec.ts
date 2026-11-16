import { expect, test } from "@playwright/test";

const origin = "http://localhost:4000";
const person = (userId: string, username: string) => ({
  userId,
  username,
  displayName: username,
});

test.beforeEach(async ({ page }) => {
  await page.route(`${origin}/api/auth/login`, (route) =>
    route.fulfill({ json: { accessToken: "test-access-token" } }),
  );
  await page.route(`${origin}/api/notifications**`, (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.goto("/login");
  await page.getByLabel("Email").fill("test@example.test");
  await page.getByLabel("Password").fill("test-passphrase");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/movies\/search/);
});

test("people search appends the next page for the submitted query", async ({
  page,
}) => {
  await page.route(`${origin}/api/users/search?**`, (route) => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get("query")).toBe("al");
    const cursor = params.get("cursor");
    expect([null, "opaque-people-cursor"]).toContain(cursor);
    return route.fulfill({
      json: cursor
        ? { items: [person("2", "allison")], nextCursor: null }
        : { items: [person("1", "alice")], nextCursor: "opaque-people-cursor" },
    });
  });
  await page.goto("/users/search");
  await page.getByPlaceholder("Username or display name").fill("al");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("@alice")).toBeVisible();
  await page
    .getByPlaceholder("Username or display name")
    .fill("different input");
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByText("@allison")).toBeVisible();
  await expect(page.getByText("@alice")).toBeVisible();
  await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
});

test("incoming requests retain previous rows after pagination and refresh on accept", async ({
  page,
}) => {
  const first = {
    id: "one",
    fromUserId: "1",
    toUserId: "me",
    status: "PENDING",
    otherUser: person("1", "alice"),
  };
  const second = {
    ...first,
    id: "two",
    fromUserId: "2",
    otherUser: person("2", "bob"),
  };
  let accepted = false;
  await page.route(`${origin}/api/friends?**`, (route) =>
    route.fulfill({
      json: { items: accepted ? [person("2", "bob")] : [], nextCursor: null },
    }),
  );
  await page.route(`${origin}/api/friend-requests/outgoing?**`, (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route(`${origin}/api/friend-requests/incoming?**`, (route) => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor");
    expect([null, "opaque-inbox-cursor"]).toContain(cursor);
    return route.fulfill({
      json: cursor
        ? { items: [second], nextCursor: null }
        : {
            items: [first],
            nextCursor: accepted ? null : "opaque-inbox-cursor",
          },
    });
  });
  await page.route(`${origin}/api/friend-requests/two/accept`, (route) => {
    expect(route.request().method()).toBe("POST");
    accepted = true;
    return route.fulfill({ json: { ...second, status: "ACCEPTED" } });
  });
  await page.goto("/friends");
  await page.getByRole("button", { name: "Incoming" }).click();
  await expect(page.getByText("alice → me")).toBeVisible();
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByText("alice → me")).toBeVisible();
  await page
    .getByRole("listitem")
    .filter({ hasText: "bob → me" })
    .getByRole("button", { name: "Accept" })
    .click();
  await expect(page.getByText("bob → me")).toHaveCount(0);
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await expect(page.getByText("@bob")).toBeVisible();
});
