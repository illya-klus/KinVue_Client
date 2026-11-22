import { expect, test } from "@playwright/test";

test("schedule a viewing, list it, and cancel it", async ({ page }) => {
  const scheduleId = "a21d1ceb-bce4-42e2-b6c4-4f5aa094e123";
  const roomId = "c3396b50-e70b-4f75-a40c-6dbab45da592";
  let schedule: Record<string, unknown> | null = null;

  await page.route("http://localhost:4000/api/auth/refresh", route => route.fulfill({json:{accessToken:"test-token"}}));
  await page.route("http://localhost:4000/api/movies/movie-1", (route) =>
    route.fulfill({ json: { id: "movie-1", title: "Test movie" } }),
  );
  await page.route("http://localhost:4000/api/scheduled-rooms**", async (route) => {
    if (route.request().method() === "POST" && route.request().url().endsWith("/cancel")) {
      schedule = { ...schedule, status: "CANCELLED" };
      await route.fulfill({ json: schedule });
      return;
    }
    if (route.request().method() === "POST") {
      schedule = {
        scheduledRoomId: scheduleId,
        roomId,
        ownerId: "5e4ae5fd-e66b-4bd7-9107-98d79027480c",
        movieId: "movie-1",
        visibility: "PRIVATE",
        scheduledFor: "2027-01-01T18:00:00.000Z",
        status: "SCHEDULED",
        inviteeIds: [],
        ...(route.request().postDataJSON() as object),
      };
      await route.fulfill({ json: schedule });
      return;
    }
    await route.fulfill({ json: { items: schedule ? [schedule] : [] } });
  });

  await page.goto("/movies/movie-1");
  await expect(page.getByRole("heading", { name: "Test movie" })).toBeVisible();
  await page.getByLabel("Viewing time").fill("2027-01-01T18:00");
  await page.getByRole("button", { name: "Schedule viewing" }).click();
  await expect(page.getByRole("status")).toContainText("Viewing scheduled");

  await page.goto("/scheduled");
  await expect(page.getByRole("heading", { name: "Movie movie-1" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText(/cancelled/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
});
