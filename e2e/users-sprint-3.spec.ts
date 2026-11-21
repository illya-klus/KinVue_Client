import { expect, test } from "@playwright/test";
const api = "http://localhost:4000/api";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("kinvue.accessToken", "user-fixture"),
  );
  await page.route(api + "/notifications**", (r) =>
    r.fulfill({ json: { items: [] } }),
  );
});
test("profile shows immutable username, avatar, preferences and creation date", async ({
  page,
}) => {
  let saved = false;
  const profile = {
    username: "alice",
    displayName: "Alice",
    avatarUrl: "https://example.test/avatar.png",
    preferences: { genres: ["Adventure"], languages: ["uk"], autoplay: true },
    createdAt: "2026-11-01T00:00:00Z",
  };
  await page.route(profile.avatarUrl, (r) => r.fulfill({ status: 204 }));
  await page.route(api + "/users/me", (r) => {
    if (r.request().method() === "PATCH") {
      const body = r.request().postDataJSON();
      expect(body.username).toBeUndefined();
      expect(body.displayName).toBe("Alice updated");
      saved = true;
    }
    return r.fulfill({
      json: { ...profile, displayName: saved ? "Alice updated" : "Alice" },
    });
  });
  await page.goto("/profile");
  await expect(page.getByText(/@alice.*joined/)).toBeVisible();
  await expect(page.getByRole("img", { name: "Alice's avatar" })).toBeVisible();
  await expect(page.getByLabel("Preferred genres")).toHaveValue("Adventure");
  await expect(page.getByLabel("Display name")).toHaveValue("Alice");
  await page.getByLabel("Display name").fill("Alice updated");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile saved")).toBeVisible();
  expect(saved).toBe(true);
});
test("people search minimum, friend request conflict, outgoing and rejection", async ({
  page,
}) => {
  let searches = 0,
    rejected = false;
  await page.route(api + "/users/search?**", (r) => {
    searches++;
    return r.fulfill({
      json: {
        items: [{ userId: "alice", username: "alice", displayName: "Alice" }],
        nextCursor: null,
      },
    });
  });
  await page.route(api + "/friend-requests", (r) =>
    r.fulfill({
      status: 409,
      json: { message: "Friend request or relationship already exists" },
    }),
  );
  await page.route(api + "/friends?**", (r) =>
    r.fulfill({ json: { items: [], nextCursor: null } }),
  );
  const pending = {
    id: "pending",
    fromUserId: "alice",
    toUserId: "me",
    status: "PENDING",
    otherUser: { displayName: "Alice" },
  };
  await page.route(api + "/friend-requests/incoming?**", (r) =>
    r.fulfill({ json: { items: rejected ? [] : [pending], nextCursor: null } }),
  );
  await page.route(api + "/friend-requests/outgoing?**", (r) =>
    r.fulfill({
      json: {
        items: [{ ...pending, id: "sent", fromUserId: "me", toUserId: "bob" }],
        nextCursor: null,
      },
    }),
  );
  await page.route(api + "/friend-requests/pending/reject", (r) => {
    expect(r.request().method()).toBe("POST");
    rejected = true;
    return r.fulfill({ json: { ...pending, status: "REJECTED" } });
  });
  await page.goto("/users/search");
  await page.getByPlaceholder("Username or display name").fill("a");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Enter at least 2 characters.")).toBeVisible();
  expect(searches).toBe(0);
  await page.getByPlaceholder("Username or display name").fill("al");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(
    page.getByText("Friend request or relationship already exists"),
  ).toBeVisible();
  await page.goto("/friends");
  await expect(page.getByText("No friends yet")).toBeVisible();
  await page.getByRole("button", { name: "Outgoing" }).click();
  await expect(page.getByText("Alice → bob")).toBeVisible();
  await page.getByRole("button", { name: "Incoming" }).click();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.getByText("Nothing here")).toBeVisible();
  expect(rejected).toBe(true);
});
