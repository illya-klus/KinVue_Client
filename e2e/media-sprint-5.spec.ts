import { expect, test } from "@playwright/test";
const api = "http://localhost:4000/api";
const movieId = "5be42c7e-9e33-44ab-9234-1d9ab8ae0139";

test("multipart retains successful parts, renews URLs and retries only unfinished parts", async ({
  page,
}) => {
  const payload = Buffer.from(JSON.stringify({ scopes: ["admin"] })).toString(
    "base64url",
  );
  await page.route(api + "/auth/refresh", (r) =>
    r.fulfill({ json: { accessToken: `test.${payload}.signature` } }),
  );
  await page.route(api + "/notifications**", (r) =>
    r.fulfill({ json: { items: [] } }),
  );
  let initializations = 0,
    renewals = 0,
    allowSecond = false;
  const calls = [0, 0];
  const parts = [1, 2].map((partNumber) => ({
    partNumber,
    url: `https://storage.example.test/part-${partNumber}`,
  }));
  await page.route(api + `/admin/movies/${movieId}/upload/init`, async (r) => {
    initializations++;
    expect(r.request().postDataJSON().partCount).toBe(2);
    await r.fulfill({ json: { uploadId: movieId, parts } });
  });
  await page.route(
    api + `/admin/movies/${movieId}/upload/${movieId}/parts`,
    (r) => {
      renewals++;
      return r.fulfill({ json: { uploadId: movieId, parts } });
    },
  );
  await page.route("https://storage.example.test/**", (r) => {
    expect(r.request().method()).toBe("PUT");
    expect(r.request().headers().authorization).toBeUndefined();
    const index = r.request().url().endsWith("1") ? 0 : 1;
    calls[index]++;
    return r.fulfill({
      status: index === 1 && !allowSecond ? 503 : 200,
      headers: {
        etag: `"etag-${index}"`,
        "access-control-expose-headers": "ETag",
        "access-control-allow-origin": "*",
      },
    });
  });
  await page.route(api + `/admin/movies/${movieId}/upload/complete`, (r) => {
    expect(r.request().postDataJSON().parts).toEqual([
      { partNumber: 1, etag: '"etag-0"' },
      { partNumber: 2, etag: '"etag-1"' },
    ]);
    return r.fulfill({ json: { ok: true, mediaStatus: "PROCESSING" } });
  });
  await page.goto(`/admin/movies/${movieId}/upload`);
  await page
    .getByLabel("Video file")
    .setInputFiles({
      name: "clip.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.alloc(9_000_000),
    });
  await page.getByRole("button", { name: "Start multipart upload" }).click();
  await expect(
    page.getByRole("button", { name: "Retry unfinished parts" }),
  ).toBeEnabled();
  expect(calls).toEqual([1, 3]);
  allowSecond = true;
  await page.getByRole("button", { name: "Retry unfinished parts" }).click();
  await expect(
    page.getByRole("button", { name: "Processing", exact: true }),
  ).toBeDisabled();
  expect(calls).toEqual([1, 4]);
  expect(initializations).toBe(1);
  expect(renewals).toBe(1);
});

test("HLS loads signed master, nested playlist and segment directly from storage", async ({
  page,
}) => {
  await page.route(api + "/auth/refresh", (r) =>
    r.fulfill({ json: { accessToken: "test-token" } }),
  );
  await page.route(api + `/movies/${movieId}`, (r) =>
    r.fulfill({ json: { id: movieId, title: "HLS movie" } }),
  );
  let accessRequested = false;
  await page.route(api + `/movies/${movieId}/media-access`, (r) => {
    accessRequested = true;
    return r.fulfill({
      json: {
        url: "https://storage.example.test/master.m3u8?signature=master",
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      },
    });
  });
  const mediaRequests: string[] = [];
  await page.route("https://storage.example.test/**", (r) => {
    expect(accessRequested).toBe(true);
    const url = new URL(r.request().url());
    mediaRequests.push(url.pathname);
    expect(url.searchParams.has("signature")).toBe(true);
    if (url.pathname === "/master.m3u8")
      return r.fulfill({
        contentType: "application/vnd.apple.mpegurl",
        body: "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1500000\nhttps://storage.example.test/480.m3u8?signature=variant\n",
      });
    if (url.pathname === "/480.m3u8")
      return r.fulfill({
        contentType: "application/vnd.apple.mpegurl",
        body: "#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\nhttps://storage.example.test/segment.ts?signature=segment\n#EXT-X-ENDLIST\n",
      });
    return r.fulfill({
      contentType: "video/mp2t",
      body: Buffer.alloc(188 * 3, 0x47),
    });
  });
  await page.goto(`/movies/${movieId}`);
  await expect.poll(() => mediaRequests).toContain("/segment.ts");
  await page.getByRole("link", { name: "Movies", exact: true }).click();
  await expect(page.locator("video")).toHaveCount(0);
});
