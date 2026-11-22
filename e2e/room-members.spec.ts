import { expect, test } from "@playwright/test";

const ownerId = "e080c5e5-440e-4140-9617-a526748669d1";
const viewerId = "3f8632a5-0bb2-46e6-8c34-0efad23a4d86";
const roomId = "b8c9dbfa-8ec0-4500-a47c-a708d4983332";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("kinvue.accessToken", "test-token");
  });
});

test("owners can invite, copy a private link, and manage member roles", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  let viewerRole: "VIEWER" | "CONTROLLER" = "VIEWER";
  await page.route(`http://localhost:4000/api/rooms/${roomId}/members`, (route) =>
    route.fulfill({
      json: {
        roomId,
        movieId: "movie-1",
        visibility: "PRIVATE",
        ownerId,
        currentUserRole: "OWNER",
        members: [
          { userId: ownerId, role: "OWNER", presence: "ONLINE" },
          { userId: viewerId, role: viewerRole, presence: "OFFLINE" },
        ],
      },
    }),
  );
  await page.route(`http://localhost:4000/api/rooms/${roomId}/invites`, async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ targetUserId: viewerId, role: "VIEWER" });
    await route.fulfill({ json: { status: "PENDING" } });
  });
  await page.route(`http://localhost:4000/api/rooms/${roomId}/invites/link`, (route) =>
    route.fulfill({
      json: { roomId, inviteToken: "one-time-secret", expiresAt: "2026-11-23T00:00:00Z" },
    }),
  );
  await page.route(`http://localhost:4000/api/rooms/${roomId}/permissions`, async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ userId: viewerId, role: "CONTROLLER" });
    viewerRole = "CONTROLLER";
    await route.fulfill({ json: { roomId, userId: viewerId, role: viewerRole } });
  });

  await page.goto(`/rooms/${roomId}`);
  await page.getByLabel("Target user UUID").fill(viewerId);
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Invite sent");
  await page.getByRole("button", { name: "Create and copy invite link" }).click();
  await expect(page.getByRole("status")).toContainText("Private invite link copied");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(
    `${page.url().split("/rooms/")[0]}/invite/${roomId}#token=one-time-secret`,
  );
  await page.getByLabel(`Role for ${viewerId}`).selectOption("CONTROLLER");
  await expect(page.getByLabel(`Role for ${viewerId}`)).toHaveValue("CONTROLLER");
  await expect(page.getByText(`${ownerId} · OWNER · online`)).toBeVisible();
  await expect(page.getByText(`${viewerId} · CONTROLLER · offline`)).toBeVisible();
});

test("non-owners can see members but not owner controls", async ({ page }) => {
  await page.route(`http://localhost:4000/api/rooms/${roomId}/members`, (route) =>
    route.fulfill({
      json: {
        roomId,
        movieId: "movie-1",
        visibility: "PUBLIC",
        ownerId,
        currentUserRole: "VIEWER",
        members: [
          { userId: ownerId, role: "OWNER", presence: "ONLINE" },
          { userId: viewerId, role: "VIEWER", presence: "ONLINE" },
        ],
      },
    }),
  );
  await page.goto(`/rooms/${roomId}`);
  await expect(page.getByText(`${ownerId} · OWNER · online`)).toBeVisible();
  await expect(page.getByText(`${viewerId} · VIEWER · online`)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invite friend" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create and copy invite link" })).toHaveCount(0);
  await expect(page.getByLabel(`Role for ${viewerId}`)).toHaveCount(0);
});

test("an invite link accepts its fragment token", async ({ page }) => {
  await page.route(`http://localhost:4000/api/rooms/${roomId}/invites/accept`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({ token: "one-time-secret" });
    await route.fulfill({ json: { roomId, userId: viewerId, role: "VIEWER" } });
  });
  await page.route(`http://localhost:4000/api/rooms/${roomId}/members`, (route) =>
    route.fulfill({
      json: {
        roomId,
        movieId: "movie-1",
        visibility: "PRIVATE",
        ownerId,
        currentUserRole: "VIEWER",
        members: [{ userId: viewerId, role: "VIEWER", presence: "ONLINE" }],
      },
    }),
  );
  await page.goto(`/invite/${roomId}#token=one-time-secret`);
  await expect(page).toHaveURL(new RegExp(`/rooms/${roomId}$`));
  await expect(page.getByText(`${viewerId} · VIEWER · online`)).toBeVisible();
});
