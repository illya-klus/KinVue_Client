import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";
test.setTimeout(60000);
const roomId = "61c316d0-148d-4139-a6f0-231025742d04",
  userId = "ca909eab-586e-4a1a-8c0e-4a8ce57a2b35";
const api = "http://localhost:4000/api";
const sync = (role = "OWNER", version = 0) => ({
  type: "room.state_sync",
  roomId,
  userId,
  role,
  movieId: "fixture",
  playbackStatus: "PAUSED",
  positionSeconds: 7,
  updatedAt: new Date().toISOString(),
  version,
});
async function setup(page: Page) {
  const sockets: WebSocketRoute[] = [],
    sent: Record<string, unknown>[] = [];
  await page.route(api + "/auth/refresh", (r) =>
    r.fulfill({ json: { accessToken: "room-test-token" } }),
  );
  await page.route(api + "/notifications**", (r) =>
    r.fulfill({ json: { items: [] } }),
  );
  await page.route(api + "/rooms/" + roomId + "/members", (r) =>
    r.fulfill({
      json: {
        roomId,
        ownerId: userId,
        currentUserRole: "OWNER",
        visibility: "PUBLIC",
        members: [],
      },
    }),
  );
  await page.route(api + "/movies/fixture/media-access", (r) =>
    r.fulfill({
      status: 503,
      json: { message: "Media belongs to the next sprint" },
    }),
  );
  await page.routeWebSocket("ws://localhost:4014/rooms**", (route) => {
    const url = new URL(route.url());
    expect(url.searchParams.get("roomId")).toBe(roomId);
    expect(url.searchParams.get("token")).toBe("room-test-token");
    sockets.push(route);
    route.onMessage((raw) => {
      const event = JSON.parse(String(raw));
      sent.push(event);
      if (event.type === "room.leave")
        route.close({ code: 1000, reason: "Left room" });
    });
  });
  await page.goto("/rooms/" + roomId);
  await expect.poll(() => sockets.length).toBe(1);
  return { sockets, sent };
}
test("sync gates control, commands contain IDs, and stale versions are ignored", async ({
  page,
}) => {
  const { sockets, sent } = await setup(page);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeDisabled();
  sockets[0].send(JSON.stringify({ ...sync(), role: "INVALID" }));
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeDisabled();
  sockets[0].send(JSON.stringify(sync()));
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByLabel("Seek position (seconds)").fill("13.5");
  await page.getByRole("button", { name: "Seek", exact: true }).click();
  expect(sent.map((event) => event.type)).toEqual(["room.play", "room.seek"]);
  expect(sent[1]).toMatchObject({ roomId, positionSeconds: 13.5 });
  expect(sent[0].eventId).toMatch(/^[a-f0-9-]{36}$/);
  sockets[0].send(
    JSON.stringify({
      ...sync("OWNER", 4),
      type: "room.playback_state_changed",
      playbackStatus: "PLAYING",
      positionSeconds: 13.5,
    }),
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Your role" }),
  ).toContainText("version 4");
  sockets[0].send(
    JSON.stringify({
      ...sync("OWNER", 3),
      type: "room.playback_state_changed",
      positionSeconds: 999,
    }),
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Your role" }),
  ).toContainText("version 4");
  await expect(
    page.getByRole("status").filter({ hasText: "Your role" }),
  ).not.toContainText("999");
});
test("viewer cannot control playback but can chat and react without duplicate messages", async ({
  page,
}) => {
  const { sockets, sent } = await setup(page);
  sockets[0].send(JSON.stringify(sync("VIEWER")));
  await expect(
    page.getByText("Only the owner and controllers can change playback."),
  ).toBeVisible();
  for (const name of ["Play", "Pause", "Seek"])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  await page.getByLabel("Chat message").fill("Hello");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  expect(sent[0]).toMatchObject({
    type: "chat.message",
    roomId,
    text: "Hello",
  });
  expect(sent[0].messageId).toMatch(/^[a-f0-9-]{36}$/);
  const message = { ...sent[0], type: "chat.message_created", userId };
  sockets[0].send(JSON.stringify(message));
  sockets[0].send(JSON.stringify(message));
  await expect(page.getByText("Hello", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^React / })).toHaveCount(5);
  await page.getByRole("button", { name: "React fire", exact: true }).click();
  expect(sent[1]).toMatchObject({ type: "chat.reaction", emoji: "fire" });
  sockets[0].send(
    JSON.stringify({ ...sent[1], type: "chat.reaction_created", userId }),
  );
  await expect(page.getByLabel("Recent reactions")).toContainText("🔥");
  await expect(page.getByLabel("Chat message")).toHaveAttribute(
    "maxlength",
    "1000",
  );
  await page.getByLabel("Chat message").fill("x".repeat(1001));
  await expect(page.getByLabel("Chat message")).toHaveValue("x".repeat(1000));
  await page.getByRole("button", { name: "Send", exact: true }).click();
  expect(String(sent.at(-1)?.text).length).toBe(1000);
});
test("reconnect waits for state_sync and live role changes disable controls", async ({
  page,
}) => {
  const { sockets } = await setup(page);
  sockets[0].send(JSON.stringify(sync("CONTROLLER", 2)));
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeEnabled();
  sockets[0].close({ code: 1012, reason: "Resync" });
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeDisabled();
  await expect.poll(() => sockets.length).toBe(2);
  sockets[1].send(
    JSON.stringify({
      ...sync("CONTROLLER", 8),
      type: "room.playback_state_changed",
    }),
  );
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeDisabled();
  sockets[1].send(JSON.stringify(sync("CONTROLLER", 9)));
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeEnabled();
  sockets[1].send(
    JSON.stringify({
      type: "room.role_changed",
      roomId,
      userId,
      role: "VIEWER",
    }),
  );
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeDisabled();
});
test("heartbeat follows 30 seconds and leaving stops participation", async ({
  page,
}) => {
  await page.clock.install();
  const { sockets, sent } = await setup(page);
  sockets[0].send(JSON.stringify(sync()));
  await expect(page.getByRole("button", { name: "Leave room" })).toBeEnabled();
  await page.clock.runFor(30001);
  expect(sent.some((event) => event.type === "room.heartbeat")).toBe(true);
  await page.getByRole("button", { name: "Leave room" }).click();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("link", { name: "Back to rooms" })).toBeVisible();
  expect(sent.at(-1)).toMatchObject({ type: "room.leave", roomId });
});
