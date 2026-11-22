import { expect, test } from "@playwright/test";

const publicRoomId = "b8c9dbfa-8ec0-4500-a47c-a708d4983332";
const ownerId = "e080c5e5-440e-4140-9617-a526748669d1";
const viewerId = "3f8632a5-0bb2-46e6-8c34-0efad23a4d86";

test("public room list shows only API results and joins the selected room", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("kinvue.accessToken", "test-token");
  });
  await page.route("http://localhost:4000/api/rooms/public", (route) =>
    route.fulfill({
      json: {
        items: [
          { id: publicRoomId, movieId: "movie-1", visibility: "PUBLIC", memberCount: 2 },
        ],
      },
    }),
  );
  await page.route(`http://localhost:4000/api/rooms/${publicRoomId}/members`, (route) =>
    route.fulfill({
      json: {
        roomId: publicRoomId,
        movieId: "movie-1",
        visibility: "PUBLIC",
        ownerId,
        currentUserRole: "VIEWER",
        members: [{ userId: viewerId, role: "VIEWER", presence: "ONLINE" }],
      },
    }),
  );

  await page.goto("/rooms");
  await expect(page.getByRole("heading", { name: "Public rooms" })).toBeVisible();
  await expect(page.getByText(`Room ${publicRoomId}`)).toBeVisible();
  await expect(page.getByText("Movie movie-1")).toBeVisible();
  await expect(page.getByRole("link", { name: "Join" })).toHaveAttribute(
    "href",
    `/rooms/${publicRoomId}`,
  );
  await page.getByRole("link", { name: "Join" }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${publicRoomId}$`));
  await expect(page.getByText(`${viewerId} · VIEWER · online`)).toBeVisible();
});
