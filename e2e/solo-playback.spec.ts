import { expect, test } from "@playwright/test";

test("solo playback requests media access and stops on navigation", async ({ page }) => {
  const mediaUrl = "https://media.example.test/movie-1.mp4";
  const roomSockets: string[] = [];
  const mediaAccessRequests: string[] = [];
  let mediaAccessAuthorization: string | undefined;

  page.on("websocket", (socket) => {
    if (new URL(socket.url()).pathname === "/rooms") {
      roomSockets.push(socket.url());
    }
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("kinvue.accessToken", "test-token");
  });
  await page.route("http://localhost:4000/api/movies/movie-1", (route) =>
    route.fulfill({ json: { id: "movie-1", title: "Solo test movie" } }),
  );
  await page.route("http://localhost:4000/api/movies/movie-1/media-access", async (route) => {
    expect(route.request().method()).toBe("POST");
    mediaAccessAuthorization = route.request().headers().authorization;
    mediaAccessRequests.push(route.request().url());
    await route.fulfill({ json: { url: mediaUrl } });
  });
  await page.route("https://media.example.test/**", (route) => route.abort());

  await page.goto("/movies/movie-1");
  await expect(page.getByRole("heading", { name: "Solo test movie" })).toBeVisible();
  await expect.poll(() => mediaAccessRequests.length).toBeGreaterThan(0);
  expect(mediaAccessAuthorization).toBe("Bearer test-token");
  await expect(page.locator("video")).toHaveAttribute("src", mediaUrl);
  expect(mediaAccessRequests).toEqual(
    Array(mediaAccessRequests.length).fill(
      "http://localhost:4000/api/movies/movie-1/media-access",
    ),
  );
  expect(roomSockets).toEqual([]);

  await page.getByRole("link", { name: "Movies" }).click();
  await expect(page).toHaveURL(/\/movies\/search$/);
  await expect(page.locator("video")).toHaveCount(0);
  expect(roomSockets).toEqual([]);
});
