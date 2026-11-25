import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  backend,
  cleanFixtures,
  grantFixtureAdmin,
} from "./support/live-fixtures";

const api = "http://localhost:4000/api";
type Identity = {
  userId: string;
  email: string;
  password: string;
  username: string;
  token: string;
};
type Frame = { type: string; version?: number; [key: string]: unknown };
test.describe("Sprint 6 disposable full-stack acceptance", () => {
  test.skip(
    process.env.E2E_SPRINT6 !== "1",
    "Requires the isolated Sprint 6 backend and generated media fixture",
  );
  test("profiles, friendship, publication, private HLS, realtime and recovery", async ({
    browser,
  }) => {
    test.setTimeout(600_000);
    const userIds: string[] = [],
      movieIds: string[] = [],
      roomIds: string[] = [],
      sessions: string[] = [];
    const contexts = [await browser.newContext(), await browser.newContext()];
    const ownerPage = await contexts[0].newPage(),
      friendPage = await contexts[1].newPage();
    const sockets: Frame[][] = [],
      storageRequests: string[] = [],
      forbidden: string[] = [];
    let owner: Identity | undefined;
    for (const page of [ownerPage, friendPage]) {
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (["4001", "4002", "4003", "4004"].includes(url.port))
          forbidden.push(url.origin + url.pathname);
        if (url.port === "9000" && request.method() === "GET") {
          expect(url.searchParams.has("X-Amz-Signature")).toBe(true);
          storageRequests.push(url.pathname);
        }
      });
      page.on("response", async (response) => {
        if (response.url().endsWith("/media-access") && response.ok()) {
          const access = await response.json().catch(() => null);
          const session = access?.url?.match(
            /\/_access\/([0-9a-f-]{36})\//,
          )?.[1];
          if (session && !sessions.includes(session)) sessions.push(session);
        }
      });
      page.on("websocket", (socket) => {
        const url = new URL(socket.url());
        if (url.pathname !== "/rooms") return;
        expect(url.port).toBe("4014");
        const frames: Frame[] = [];
        sockets.push(frames);
        socket.on("framereceived", (frame) => {
          if (typeof frame.payload === "string")
            frames.push(JSON.parse(frame.payload));
        });
      });
    }
    async function signIn(
      page: Page,
      identity: Omit<Identity, "token">,
    ): Promise<Identity> {
      await page.goto("/login");
      await page.getByLabel("Email").fill(identity.email);
      await page
        .getByLabel("Password", { exact: true })
        .fill(identity.password);
      const response = page.waitForResponse(
        (r) =>
          r.url() === api + "/auth/login" && r.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      const result = await response;
      expect(result.status()).toBe(201);
      const { accessToken } = await result.json();
      await expect(page).toHaveURL(/\/movies\/search$/);
      return { ...identity, token: accessToken };
    }
    async function register(page: Page, label: string): Promise<Identity> {
      const unique = randomUUID().replaceAll("-", "").slice(0, 12);
      const identity = {
        email: `s6-${label}-${unique}@example.test`,
        password: `S6-password-${unique}-!`,
        username: `s6_${label}_${unique}`,
        userId: "",
      };
      await page.goto("/register");
      await page.getByLabel("Email").fill(identity.email);
      await page.getByLabel("Username").fill(identity.username);
      await page
        .getByLabel("Display name", { exact: true })
        .fill(`S6 ${label} ${unique}`);
      await page.getByLabel("Password (min 12)").fill(identity.password);
      await page.getByLabel("Confirm password").fill(identity.password);
      const registration = page.waitForResponse(
        (r) =>
          r.url() === api + "/auth/register" && r.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Register", exact: true }).click();
      const registered = await registration;
      expect(registered.status()).toBe(201);
      const body = await registered.json();
      expect(body.status).toBe("ACTIVE");
      identity.userId = body.userId;
      expect(identity.userId).toMatch(/^[0-9a-f-]{36}$/i);
      userIds.push(identity.userId);
      return signIn(page, identity);
    }
    async function createDraft(title: string) {
      await ownerPage.goto("/admin/movies");
      await ownerPage.getByLabel("Title", { exact: true }).fill(title);
      await ownerPage
        .getByLabel("Description", { exact: true })
        .fill("Disposable Sprint 6 video fixture");
      await ownerPage.getByLabel("Genres (comma-separated)").fill("Test");
      const response = ownerPage.waitForResponse(
        (r) =>
          r.url() === api + "/admin/movies" && r.request().method() === "POST",
      );
      await ownerPage
        .getByRole("button", { name: "Create draft", exact: true })
        .click();
      const created = await response;
      expect(created.status()).toBe(201);
      const body = await created.json();
      const id = body.movieId ?? body.id;
      movieIds.push(id);
      return id as string;
    }
    const roomStatus = (page: Page) =>
      page.getByRole("status").filter({ hasText: "Your role:" });
    const fault = (args: string[]) => {
      const result = spawnSync(
        "docker",
        ["compose", "--env-file", ".env.example", "--profile", "apps", ...args],
        { cwd: backend, encoding: "utf8", windowsHide: true },
      );
      expect(result.status, "Disposable fault injection command failed").toBe(
        0,
      );
    };
    try {
      owner = await register(ownerPage, "owner");
      const friend = await register(friendPage, "friend");
      grantFixtureAdmin(owner.userId);
      await ownerPage.getByRole("button", { name: "Log out" }).click();
      await expect(ownerPage).toHaveURL(/\/login$/);
      owner = await signIn(ownerPage, owner);
      const ownerName = `Updated ${owner.username}`;
      await test.step("KIN-253: profile changes survive reload", async () => {
        await ownerPage.goto("/profile");
        await ownerPage
          .getByLabel("Display name", { exact: true })
          .fill(ownerName);
        await ownerPage
          .getByLabel("Preferred genres (comma-separated)")
          .fill("Drama, Sci-Fi");
        await ownerPage.getByLabel("Languages", { exact: true }).fill("uk, en");
        await ownerPage.getByLabel("Autoplay trailers").check();
        await ownerPage.getByRole("button", { name: "Save changes" }).click();
        await expect(
          ownerPage.getByText("Profile saved", { exact: true }),
        ).toBeVisible();
        await ownerPage.reload();
        await expect(
          ownerPage.getByLabel("Display name", { exact: true }),
        ).toHaveValue(ownerName);
        await expect(
          ownerPage.getByLabel("Preferred genres (comma-separated)"),
        ).toHaveValue("Drama, Sci-Fi");
        await expect(
          ownerPage.getByLabel("Languages", { exact: true }),
        ).toHaveValue("uk, en");
        await expect(ownerPage.getByLabel("Autoplay trailers")).toBeChecked();
      });
      await test.step("KIN-254/KIN-256: minimum search and mutual friendship", async () => {
        await ownerPage.goto("/users/search");
        const input = ownerPage.getByPlaceholder("Username or display name");
        const queries: string[] = [];
        ownerPage.on("request", (r) => {
          if (r.url().includes("/api/users/search")) queries.push(r.url());
        });
        await input.fill("s");
        await ownerPage
          .getByRole("button", { name: "Search", exact: true })
          .click();
        expect(queries).toHaveLength(0);
        await input.fill(friend.username);
        await ownerPage
          .getByRole("button", { name: "Search", exact: true })
          .click();
        const row = ownerPage
          .locator("li")
          .filter({ hasText: `@${friend.username}` });
        await expect(row).toBeVisible();
        await row.getByRole("button", { name: "Add friend" }).click();
        await expect(row.getByText("Request sent")).toBeVisible();
        await friendPage.goto("/friends");
        await friendPage
          .getByRole("button", { name: "Incoming", exact: true })
          .click();
        await friendPage
          .locator("li")
          .filter({ hasText: ownerName })
          .getByRole("button", { name: "Accept", exact: true })
          .click();
        await friendPage
          .getByRole("button", { name: "Friends", exact: true })
          .click();
        await expect(
          friendPage.locator("li").filter({ hasText: ownerName }),
        ).toBeVisible();
        await ownerPage.goto("/friends");
        await expect(
          ownerPage.locator("li").filter({ hasText: `@${friend.username}` }),
        ).toBeVisible();
      });
      const title = `S6 published ${randomUUID()}`,
        draftTitle = `S6 hidden ${randomUUID()}`;
      const draftId = await createDraft(draftTitle);
      expect(draftId).toBeTruthy();
      const movieId = await createDraft(title);
      await test.step("KIN-229/KIN-129: direct multipart retry and actual container FFmpeg", async () => {
        let failed = false;
        const puts = new Map<string, number>();
        await ownerPage.route("http://localhost:9000/**", async (route) => {
          const request = route.request(),
            url = new URL(request.url());
          if (request.method() !== "PUT" || !url.searchParams.has("partNumber"))
            return route.continue();
          const part = url.searchParams.get("partNumber")!;
          puts.set(part, (puts.get(part) ?? 0) + 1);
          if (part === "2" && !failed) {
            failed = true;
            return route.abort("failed");
          }
          return route.continue();
        });
        await ownerPage
          .getByRole("link", { name: "Upload video", exact: true })
          .click();
        await ownerPage
          .getByLabel("Video file")
          .setInputFiles(resolve(process.env.E2E_MEDIA_FIXTURE!));
        await ownerPage
          .getByRole("button", { name: "Start multipart upload", exact: true })
          .click();
        await expect(
          ownerPage.getByRole("button", { name: "Processing", exact: true }),
        ).toBeDisabled({ timeout: 90_000 });
        expect(failed).toBe(true);
        expect(puts.get("1")).toBe(1);
        expect(puts.get("2")).toBe(2);
        await expect
          .poll(
            async () => {
              const r = await ownerPage.request.get(
                `${api}/admin/movies/${movieId}`,
                { headers: { authorization: `Bearer ${owner!.token}` } },
              );
              expect(r.ok()).toBe(true);
              return (await r.json()).mediaStatus;
            },
            { timeout: 180_000, intervals: [1000, 2000, 5000] },
          )
          .toBe("READY");
      });
      await test.step("KIN-258/KIN-259: publish and published-only indexed search", async () => {
        await ownerPage.goto(`/admin/movies/${movieId}/edit`);
        await ownerPage
          .getByRole("button", { name: "Publish now", exact: true })
          .click();
        await expect(
          ownerPage.getByText(/Publication: PUBLISHED/),
        ).toBeVisible();
        await ownerPage.goto("/movies/search");
        await ownerPage.getByLabel("Search movies").fill(title);
        await expect(
          ownerPage.getByRole("link", { name: title, exact: true }),
        ).toBeVisible({ timeout: 30_000 });
        await ownerPage.getByLabel("Search movies").fill(draftTitle);
        await expect(
          ownerPage.getByRole("link", { name: draftTitle, exact: true }),
        ).toHaveCount(0);
        const r = await ownerPage.request.get(
          `${api}/movies/search?q=${encodeURIComponent(draftTitle)}`,
        );
        expect(r.ok()).toBe(true);
        expect(JSON.stringify(await r.json())).not.toContain(draftId);
      });
      await test.step("KIN-129/KIN-261: decode signed HLS and toggle watchlist", async () => {
        await ownerPage.goto(`/movies/${movieId}`);
        const video = ownerPage.locator("video");
        await expect
          .poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState), {
            timeout: 45_000,
          })
          .toBeGreaterThanOrEqual(2);
        await video.evaluate(async (el: HTMLVideoElement) => {
          el.muted = true;
          await el.play();
        });
        await expect
          .poll(
            () => video.evaluate((el: HTMLVideoElement) => el.currentTime),
            { timeout: 15_000 },
          )
          .toBeGreaterThan(0.3);
        expect(storageRequests.some((path) => path.endsWith(".ts"))).toBe(true);
        await ownerPage
          .getByRole("button", { name: "Add to watchlist", exact: true })
          .click();
        await ownerPage.goto("/watchlist");
        const row = ownerPage.locator("li").filter({ hasText: title });
        await expect(row).toBeVisible();
        await row.getByRole("button", { name: "Remove", exact: true }).click();
        await expect(row).toHaveCount(0);
      });
      await ownerPage.goto(`/movies/${movieId}`);
      await ownerPage.getByLabel("Public", { exact: true }).check();
      await ownerPage
        .getByRole("button", { name: "Create room", exact: true })
        .click();
      await expect(ownerPage).toHaveURL(/\/rooms\/[0-9a-f-]+$/i);
      const roomId = new URL(ownerPage.url()).pathname.split("/").at(-1)!;
      roomIds.push(roomId);
      await expect(roomStatus(ownerPage)).toContainText("OWNER");
      await friendPage.goto(`/rooms/${roomId}`);
      await expect(roomStatus(friendPage)).toContainText("VIEWER");
      await expect(
        friendPage.getByRole("button", { name: "Play", exact: true }),
      ).toBeDisabled();
      await ownerPage
        .getByLabel(`Role for ${friend.userId}`)
        .selectOption("CONTROLLER");
      await expect(roomStatus(friendPage)).toContainText("CONTROLLER");
      await test.step("KIN-288/KIN-292/KIN-293: bidirectional playback, chat and reactions", async () => {
        await ownerPage
          .getByRole("button", { name: "Play", exact: true })
          .click();
        await expect(roomStatus(friendPage)).toContainText("PLAYING");
        await friendPage
          .getByRole("button", { name: "Pause", exact: true })
          .click();
        await expect(roomStatus(ownerPage)).toContainText("PAUSED");
        await friendPage.getByLabel("Seek position (seconds)").fill("6");
        await friendPage
          .getByRole("button", { name: "Seek", exact: true })
          .click();
        await expect(roomStatus(ownerPage)).toContainText("@ 6s");
        await ownerPage.getByLabel("Seek position (seconds)").fill("4");
        await ownerPage
          .getByRole("button", { name: "Seek", exact: true })
          .click();
        await expect(roomStatus(friendPage)).toContainText("@ 4s");
        await ownerPage.getByLabel("Chat message").fill("hello from owner");
        await ownerPage
          .getByRole("button", { name: "Send", exact: true })
          .click();
        await expect(friendPage.getByLabel("Room chat")).toContainText(
          "hello from owner",
        );
        await friendPage.getByLabel("Chat message").fill("hello from friend");
        await friendPage
          .getByRole("button", { name: "Send", exact: true })
          .click();
        await expect(ownerPage.getByLabel("Room chat")).toContainText(
          "hello from friend",
        );
        await friendPage.getByRole("button", { name: "React fire" }).click();
        await expect(ownerPage.getByLabel("Recent reactions")).toContainText(
          "🔥",
        );
        await ownerPage.getByRole("button", { name: "React laugh" }).click();
        await expect(friendPage.getByLabel("Recent reactions")).toContainText(
          "😂",
        );
      });
      await test.step("KIN-205/KIN-294: interrupted Pub/Sub reconnects with snapshot, not replay", async () => {
        const before = sockets.length;
        fault([
          "exec",
          "-T",
          "rooms-redis",
          "redis-cli",
          "CLIENT",
          "KILL",
          "TYPE",
          "pubsub",
        ]);
        await expect
          .poll(() => sockets.length, { timeout: 30_000 })
          .toBeGreaterThanOrEqual(before + 2);
        await expect(roomStatus(ownerPage)).toContainText("@ 4s", {
          timeout: 30_000,
        });
        await expect(roomStatus(friendPage)).toContainText("@ 4s");
        for (const frames of sockets.slice(before)) {
          await expect.poll(() => frames.length).toBeGreaterThan(0);
          expect(frames[0].type).toBe("room.state_sync");
          expect(
            frames.filter((f) => f.type === "room.playback_state_changed"),
          ).toHaveLength(0);
        }
      });
      await test.step("KIN-182: restarted Rooms process resynchronizes both browsers", async () => {
        const before = sockets.length;
        fault(["restart", "rooms"]);
        await expect
          .poll(() => sockets.length, { timeout: 60_000 })
          .toBeGreaterThanOrEqual(before + 2);
        await expect(roomStatus(ownerPage)).toContainText("@ 4s", {
          timeout: 60_000,
        });
        await expect(roomStatus(friendPage)).toContainText("@ 4s");
        await expect
          .poll(
            () =>
              sockets
                .slice(before)
                .filter((frames) => frames[0]?.type === "room.state_sync")
                .length,
          )
          .toBeGreaterThanOrEqual(2);
      });
      expect(forbidden).toEqual([]);
    } finally {
      if (owner)
        for (const id of roomIds) {
          const r = await ownerPage.request.delete(`${api}/rooms/${id}`, {
            headers: { authorization: `Bearer ${owner.token}` },
          });
          expect(r.ok()).toBe(true);
        }
      await Promise.all(contexts.map((context) => context.close()));
      await cleanFixtures(userIds, movieIds, sessions);
    }
  });
});
