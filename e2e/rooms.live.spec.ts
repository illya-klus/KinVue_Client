import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const liveStack = process.env.E2E_STACK === "1";
const movieId = "aeb60a91-940b-41c9-a011-5b88ea76b387";
const api = "http://localhost:4000/api";

type Identity = {
  email: string;
  password: string;
  userId: string;
  username: string;
  token: string;
};
let soloPlaybackIdentity: Pick<Identity, "email" | "password"> | undefined;
let liveIdentities: { owner: Identity; friend: Identity; outsider: Identity } | undefined;

function tokenSubject(token: string) {
  const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()) as {
    sub?: string;
  };
  expect(payload.sub).toMatch(/^[0-9a-f-]{36}$/i);
  return payload.sub!;
}

async function openMovieFixture(page: Page) {
  await expect(page.getByRole("heading", { name: "Movie search" })).toBeVisible();
  await page.getByLabel("Search movies").fill("Rooms live E2E fixture");
  const movieLink = page.getByRole("link", { name: "Rooms live E2E fixture", exact: true });
  await expect(movieLink).toBeVisible({ timeout: 30_000 });
  await movieLink.click();
  await expect(page).toHaveURL(new RegExp(`/movies/${movieId}$`));
  await expect(page.getByRole("heading", { name: "Rooms live E2E fixture" })).toBeVisible();
}

async function registerAndSignIn(page: Page, label: string): Promise<Identity> {
  const id = randomUUID().replaceAll("-", "").slice(0, 16);
  const email = `kinvue-${label}-${id}@example.test`;
  const password = `E2e-password-${id}-!`;
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Username").fill(`e2e_${id}`);
  await page.getByLabel("Display name").fill(`E2E ${label}`);
  await page.getByLabel("Password (min 12)").fill(password);
  await page.getByLabel("Confirm password").fill(password);
  const registration = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/register") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Register" }).click();
  expect((await registration).status()).toBe(201);
  await expect(page).toHaveURL(/\/login$/);

  const login = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST",
  );
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  const loginResponse = await login;
  expect(loginResponse.status()).toBe(201);
  const { accessToken } = (await loginResponse.json()) as { accessToken: string };
  await expect(page).toHaveURL(/\/movies\/search$/);
  return {
    email,
    password,
    token: accessToken,
    userId: tokenSubject(accessToken),
    username: `e2e_${id}`,
  };
}

async function signInExisting(page: Page, identity: Identity) {
  await page.goto("/login");
  const login = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/login") &&
      response.request().method() === "POST",
  );
  await page.getByLabel("Email").fill(identity.email);
  await page.getByLabel("Password").fill(identity.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await login).status()).toBe(201);
  await expect(page).toHaveURL(/\/movies\/search$/);
}

test.describe("Live Rooms journeys through Gateway and Rooms (KIN-268/272/275/279/290)", () => {
  test.describe.configure({ mode: "serial", retries: 0 });
  test.skip(!liveStack, "Run with E2E_STACK=1 against the disposable live stack");

  test("private invitation, public discovery, member roles and playback authorization", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const ownerContext = await browser.newContext();
    const friendContext = await browser.newContext();
    const outsiderContext = await browser.newContext();
    await ownerContext.grantPermissions(["clipboard-read", "clipboard-write"]);
    const ownerPage = await ownerContext.newPage();
    const friendPage = await friendContext.newPage();
    const outsiderPage = await outsiderContext.newPage();
    const ownerSockets: string[] = [];
    ownerPage.on("websocket", (socket) => ownerSockets.push(socket.url()));

    let owner: Identity | undefined;
    const roomIds: string[] = [];
    try {
      owner = await registerAndSignIn(ownerPage, "owner");
      // Reuse this account in the following solo-playback test. Gateway deliberately
      // limits registration to three requests per minute, and this journey already
      // creates the owner, friend, and outsider accounts.
      soloPlaybackIdentity = { email: owner.email, password: owner.password };
      const friend = await registerAndSignIn(friendPage, "friend");
      const outsider = await registerAndSignIn(outsiderPage, "outsider");
      liveIdentities = { owner, friend, outsider };

      await openMovieFixture(ownerPage);
      await expect(ownerPage.getByRole("heading", { name: "Watch room" })).toBeVisible({ timeout: 30_000 });
      await ownerPage.getByLabel("Private").check();
      await ownerPage.getByRole("button", { name: "Create room" }).click();
      await expect(ownerPage).toHaveURL(/\/rooms\/[0-9a-f-]+$/i, { timeout: 30_000 });
      const privateRoomId = new URL(ownerPage.url()).pathname.split("/").at(-1)!;
      roomIds.push(privateRoomId);
      await expect(ownerPage.getByRole("status").filter({ hasText: "Your role" })).toContainText("OWNER", { timeout: 30_000 });

      const privateSocket = await expect.poll(() => ownerSockets.find((url) => new URL(url).searchParams.get("roomId") === privateRoomId)).toBeTruthy();
      void privateSocket;
      const ownerSocketUrl = new URL(ownerSockets.find((url) => new URL(url).searchParams.get("roomId") === privateRoomId)!);
      expect(ownerSocketUrl.pathname).toBe("/rooms");
      expect(ownerSocketUrl.searchParams.get("token")).toBe(owner.token);

      await ownerPage.getByRole("button", { name: "Create and copy invite link" }).click();
      await expect(ownerPage.getByText("Private invite link copied.", { exact: true })).toBeVisible();
      const privateInvite = await ownerPage.evaluate(() => navigator.clipboard.readText());
      expect(privateInvite).toMatch(new RegExp(`/invite/${privateRoomId}#token=`));

      const outsiderJoin = await outsiderPage.request.post(`${api}/rooms/${privateRoomId}/invites/accept`, {
        headers: { authorization: `Bearer ${outsider.token}` },
        data: { token: "invalid-invite-token" },
      });
      expect(outsiderJoin.status()).toBe(403);

      await friendPage.goto(privateInvite);
      await expect(friendPage).toHaveURL((url) =>
        url.pathname === `/rooms/${privateRoomId}` || url.pathname === "/login",
        { timeout: 30_000 },
      );
      if (new URL(friendPage.url()).pathname === "/login") {
        const login = friendPage.waitForResponse(
          (response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST",
        );
        await friendPage.getByLabel("Email").fill(friend.email);
        await friendPage.getByLabel("Password").fill(friend.password);
        await friendPage.getByRole("button", { name: "Sign in" }).click();
        const loginResponse = await login;
        expect(loginResponse.status()).toBe(201);
        friend.token = ((await loginResponse.json()) as { accessToken: string }).accessToken;
      }
      await expect(friendPage.getByRole("status").filter({ hasText: "Your role" })).toContainText("VIEWER", { timeout: 30_000 });
      await expect(friendPage.getByText("Only the owner and controllers can change playback.")).toBeVisible();
      for (const control of ["Play", "Pause", "Seek"]) {
        await expect(friendPage.getByRole("button", { name: control, exact: true })).toBeDisabled();
      }

      // Try the forbidden command over a second, real authenticated socket. Rooms must
      // reject it server-side and keep the shared playback version unchanged.
      const rejection = friendPage.evaluate(({ id, token }) => new Promise<string>((resolve, reject) => {
        const socket = new WebSocket(`ws://localhost:4014/rooms?roomId=${id}&token=${encodeURIComponent(token)}`);
        const timeout = window.setTimeout(() => { socket.close(); reject(new Error("Unauthorized playback command timed out")); }, 10_000);
        socket.addEventListener("message", (event) => {
          const message = JSON.parse(String(event.data)) as { type?: string };
          if (message.type === "room.state_sync") socket.send(JSON.stringify({ type: "room.play", roomId: id, eventId: crypto.randomUUID(), positionSeconds: 0 }));
          if (message.type === "room.error") { window.clearTimeout(timeout); socket.close(); resolve(message.type); }
        });
        socket.addEventListener("error", () => { window.clearTimeout(timeout); reject(new Error("Unauthorized socket could not be opened")); });
      }), { id: privateRoomId, token: friend.token });
      await expect(rejection).resolves.toBe("room.error");
      await expect(ownerPage.getByRole("status").filter({ hasText: "Your role" })).toContainText("version 0");

      await expect(ownerPage.getByLabel(`Role for ${friend.userId}`)).toHaveValue("VIEWER", { timeout: 30_000 });
      await ownerPage.getByLabel(`Role for ${friend.userId}`).selectOption("CONTROLLER");
      await expect(friendPage.getByRole("status").filter({ hasText: "Your role" })).toContainText("CONTROLLER", { timeout: 30_000 });
      await expect(friendPage.getByRole("button", { name: "Play", exact: true })).toBeEnabled();
      await friendPage.getByRole("button", { name: "Play", exact: true }).click();
      await expect(ownerPage.getByRole("status").filter({ hasText: "Your role" })).toContainText("PLAYING", { timeout: 10_000 });

      await ownerPage.getByRole("link", { name: "Movies" }).click();
      await openMovieFixture(ownerPage);
      await ownerPage.getByLabel("Public").check();
      await ownerPage.getByRole("button", { name: "Create room" }).click();
      await expect(ownerPage).toHaveURL(/\/rooms\/[0-9a-f-]+$/i, { timeout: 30_000 });
      const publicRoomId = new URL(ownerPage.url()).pathname.split("/").at(-1)!;
      roomIds.push(publicRoomId);
      await expect(ownerPage.getByRole("status").filter({ hasText: "Your role" })).toContainText("OWNER", { timeout: 30_000 });

      await friendPage.getByRole("link", { name: "Rooms" }).click();
      await expect(friendPage.getByRole("heading", { name: "Public rooms" })).toBeVisible();
      const roomRow = friendPage.locator("li").filter({ hasText: publicRoomId });
      await expect(roomRow).toBeVisible({ timeout: 30_000 });
      await roomRow.getByRole("link", { name: "Join" }).click();
      await expect(friendPage).toHaveURL(new RegExp(`/rooms/${publicRoomId}$`));
      await expect(friendPage.getByRole("status").filter({ hasText: "Your role" })).toContainText("VIEWER", { timeout: 30_000 });
      for (const control of ["Play", "Pause", "Seek"]) {
        await expect(friendPage.getByRole("button", { name: control, exact: true })).toBeDisabled();
      }

      await expect(friendPage.getByRole("button", { name: "Close room" })).toHaveCount(0);
      const closeResponse = ownerPage.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/rooms/${publicRoomId}`) &&
          response.request().method() === "DELETE",
      );
      ownerPage.once("dialog", (dialog) => dialog.accept());
      await ownerPage.getByRole("button", { name: "Close room" }).click();
      expect((await closeResponse).status()).toBe(200);
      roomIds.splice(roomIds.indexOf(publicRoomId), 1);
      await expect(ownerPage).toHaveURL(/\/rooms$/);
      await expect(friendPage.getByText("This room is closed.")).toBeVisible({ timeout: 10_000 });
    } finally {
      if (owner) {
        for (const roomId of roomIds) {
          const response = await ownerPage.request.delete(`${api}/rooms/${roomId}`, {
            headers: { authorization: `Bearer ${owner.token}` },
          });
          expect(response.ok(), `room cleanup for ${roomId} failed: ${response.status()}`).toBe(true);
        }
      }
      await ownerContext.close();
      await friendContext.close();
      await outsiderContext.close();
    }
  });

  test("solo playback requests signed media access without opening a room socket", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const roomSockets: string[] = [];
    page.on("websocket", (socket) => {
      if (new URL(socket.url()).pathname === "/rooms") roomSockets.push(socket.url());
    });

    try {
      expect(soloPlaybackIdentity, "the preceding room journey must create the solo test account").toBeDefined();
      await page.goto("/login");
      await page.getByLabel("Email").fill(soloPlaybackIdentity!.email);
      await page.getByLabel("Password").fill(soloPlaybackIdentity!.password);
      const login = page.waitForResponse(
        (response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Sign in" }).click();
      expect((await login).status()).toBe(201);
      await expect(page).toHaveURL(/\/movies\/search$/);
      const mediaAccess = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/movies/${movieId}/media-access`) &&
          response.request().method() === "POST",
      );
      await openMovieFixture(page);
      const response = await mediaAccess;
      expect(response.status()).toBe(200);

      const access = (await response.json()) as {
        url: string;
        expiresAt: string;
      };
      const signedUrl = new URL(access.url);
      expect(signedUrl.pathname).toContain("/kinvue-media/e2e/master.m3u8");
      expect(signedUrl.searchParams.get("X-Amz-Expires")).toBe("600");
      expect(Date.parse(access.expiresAt)).toBeGreaterThan(Date.now());
      expect(roomSockets).toEqual([]);

      const loginCookie = (await context.cookies()).find(
        (cookie) => cookie.name === "kinvue_refresh",
      );
      expect(loginCookie?.httpOnly).toBe(true);
      expect(loginCookie?.path).toBe("/api/auth");
      expect(
        (await context.cookies("http://localhost:4000/api/auth/refresh")).some(
          (cookie) => cookie.name === "kinvue_refresh",
        ),
        `refresh cookie scope: ${JSON.stringify({ domain: loginCookie?.domain, path: loginCookie?.path, sameSite: loginCookie?.sameSite })}`,
      ).toBe(true);
      let refreshRequestHasCookie = false;
      page.on("request", async (request) => {
        if (request.url().endsWith("/api/auth/refresh")) {
          refreshRequestHasCookie = Boolean(
            (await request.allHeaders()).cookie?.includes("kinvue_refresh="),
          );
        }
      });
      const refreshResponse = page.waitForResponse(
        (candidate) =>
          candidate.url().endsWith("/api/auth/refresh") &&
          candidate.request().method() === "POST",
      );
      await page.reload();
      const restoredSession = await refreshResponse;
      expect(
        restoredSession.status(),
        `refresh request included HttpOnly cookie: ${refreshRequestHasCookie}`,
      ).toBe(201);
      await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
      const restoredCookie = (await context.cookies()).find(
        (cookie) => cookie.name === "kinvue_refresh",
      );
      expect(restoredCookie?.httpOnly).toBe(true);
      await page.getByRole("button", { name: "Log out" }).click();
      await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
      expect(
        (await context.cookies()).some((cookie) => cookie.name === "kinvue_refresh"),
      ).toBe(false);
    } finally {
      await context.close();
    }
  });

  test(
    "live profile, friend request, notification and watchlist journeys",
    async ({ browser }) => {
    test.setTimeout(180_000);
      expect(
        liveIdentities,
        "the preceding room journey must create reusable live identities",
      ).toBeDefined();
    const ownerContext = await browser.newContext();
    const friendContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const friendPage = await friendContext.newPage();

    try {
      const { owner, friend } = liveIdentities!;
      await signInExisting(ownerPage, owner);
      await signInExisting(friendPage, friend);

      await ownerPage.goto("/profile");
      await expect(
        ownerPage.getByRole("heading", { name: "Your profile" }),
      ).toBeVisible();
      await expect(ownerPage.getByText(`@${owner.username}`)).toBeVisible();
      await ownerPage.getByLabel("Display name").fill("E2E owner acceptance profile");
      await ownerPage.getByRole("button", { name: "Save changes" }).click();
      await expect(ownerPage.getByText("Profile saved")).toBeVisible();

      await ownerPage.goto("/users/search");
      await ownerPage.getByPlaceholder("Username or display name").fill(friend.username);
      await ownerPage.getByRole("button", { name: "Search", exact: true }).click();
      await expect(ownerPage.getByText(`@${friend.username}`)).toBeVisible({
        timeout: 30_000,
      });
      await ownerPage.getByRole("button", { name: "Add friend" }).click();
      await expect(ownerPage.getByText("Request sent")).toBeVisible();

      const friendRequestNotice = friendPage.getByText(
        `Friend request from ${owner.userId}`,
      );
      await friendPage.getByRole("button", { name: "Notifications" }).click();
      await expect
        .poll(
          async () => {
            if (await friendRequestNotice.isVisible().catch(() => false)) {
              return true;
            }
            await friendPage
              .getByRole("button", { name: "Notifications" })
              .click();
            await friendPage
              .getByRole("button", { name: "Notifications" })
              .click();
            return friendRequestNotice.isVisible().catch(() => false);
          },
          { timeout: 30_000, intervals: [1_000, 2_000] },
        )
        .toBe(true);

      await friendPage.goto("/friends");
      await friendPage.getByRole("button", { name: "Incoming" }).click();
      const incoming = friendPage.getByRole("listitem").filter({ hasText: friend.userId });
      await expect(incoming).toContainText("PENDING");
      await incoming.getByRole("button", { name: "Accept" }).click();
      await friendPage.getByRole("button", { name: "Friends", exact: true }).click();
      await expect(friendPage.getByText(`@${owner.username}`)).toBeVisible();

      await ownerPage.getByRole("link", { name: "Movies" }).click();
      await openMovieFixture(ownerPage);
      await ownerPage.getByRole("button", { name: "Add to watchlist" }).click();
      await expect(
        ownerPage.getByRole("button", { name: "Remove from watchlist" }),
      ).toBeVisible();
      await ownerPage.goto("/watchlist");
      await expect(
        ownerPage.getByRole("link", { name: "Rooms live E2E fixture" }),
      ).toBeVisible();
      await ownerPage.getByRole("button", { name: "Remove", exact: true }).click();
      await expect(ownerPage.getByText("Watchlist is empty")).toBeVisible();

      await ownerPage.getByRole("button", { name: "Notifications" }).click();
      await expect(
        ownerPage.getByText(`${friend.userId} accepted your request`),
      ).toBeVisible({ timeout: 30_000 });
    } finally {
      await ownerContext.close();
      await friendContext.close();
    }
    },
  );
});
