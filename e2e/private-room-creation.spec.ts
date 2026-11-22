import { expect, test } from "@playwright/test";

const api = "http://localhost:4000/api";
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const movieId = process.env.E2E_ROOM_MOVIE_ID;

test.describe("Private room creation (KIN-268)", () => {
  test.skip(
    process.env.E2E_STACK !== "1" || !email || !password || !movieId,
    "Requires E2E_STACK=1, a provisioned E2E user, and E2E_ROOM_MOVIE_ID",
  );

  test("the owner creates a private room for a movie and joins it over the public socket", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    let accessToken: string | undefined;
    let roomId: string | undefined;
    const sockets: string[] = [];

    page.on("websocket", (socket) => {
      const url = new URL(socket.url());
      if (url.pathname === "/rooms") sockets.push(socket.url());
    });
    page.on("response", async (response) => {
      if (response.url() !== `${api}/auth/login`) return;
      const body = (await response.json()) as { accessToken?: string };
      accessToken = body.accessToken;
    });

    try {
      await page.goto("/login");
      await page.getByLabel("Email").fill(email!);
      await page.getByLabel("Password").fill(password!);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(/\/movies\/search$/);
      await expect.poll(() => accessToken).toBeTruthy();

      await page.goto(`/movies/${movieId}`);
      await expect(page.getByRole("heading")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Watch room" })).toBeVisible();
      await expect(page.getByLabel("Private")).toBeChecked();
      await page.getByRole("button", { name: "Create room" }).click();

      await expect(page).toHaveURL(/\/rooms\/[0-9a-f-]+$/i, { timeout: 30_000 });
      roomId = new URL(page.url()).pathname.split("/").at(-1);
      await expect(page.getByRole("status").filter({ hasText: "Your role" })).toContainText(
        "OWNER",
        { timeout: 30_000 },
      );
      await expect.poll(() => sockets.length).toBeGreaterThan(0);

      const socketUrl = new URL(sockets[0]);
      expect(socketUrl.pathname).toBe("/rooms");
      expect(socketUrl.searchParams.get("roomId")).toBe(roomId);
      expect(socketUrl.searchParams.get("token")).toBe(accessToken);
    } finally {
      if (roomId && accessToken) {
        const response = await page.request.delete(`${api}/rooms/${roomId}`, {
          headers: { authorization: `Bearer ${accessToken}` },
        });
        expect(response.ok(), `room cleanup failed: ${response.status()}`).toBe(true);
      }
    }
  });
});
