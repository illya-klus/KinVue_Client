import { expect, test, type Page } from "@playwright/test";
const api = "http://localhost:4000/api";
const movie = {
  movieId: "5be42c7e-9e33-44ab-9234-1d9ab8ae0139",
  title: "Interstellar",
  description: "A space voyage",
  genres: ["Sci-Fi"],
  publicationStatus: "DRAFT",
  mediaStatus: "NONE",
};
async function login(page: Page, admin = false) {
  const payload = Buffer.from(
    JSON.stringify({ scopes: admin ? ["admin"] : ["user"] }),
  ).toString("base64url");
  await page.route(api + "/auth/refresh", (r) =>
    r.fulfill({ json: { accessToken: `test.${payload}.signature` } }),
  );
  await page.route(api + "/notifications**", (r) =>
    r.fulfill({ json: { items: [] } }),
  );
  await page.goto("/movies/search");
}
test("admin creates a draft, retains validation input, and sees index catch-up", async ({
  page,
}) => {
  await login(page, true);
  let saves = 0,
    schedules = 0;
  await page.route(api + "/admin/movies", (r) => {
    const body = r.request().postDataJSON();
    expect(body).toEqual({
      title: "Interstellar",
      description: "A space voyage",
      genres: ["Sci-Fi"],
    });
    saves++;
    return saves === 1
      ? r.fulfill({ status: 400, json: { message: "Check the metadata" } })
      : r.fulfill({ status: 201, json: movie });
  });
  await page.route(api + `/admin/movies/${movie.movieId}/publish`, (r) =>
    r.fulfill({
      json: {
        ...movie,
        publicationStatus: "PUBLISHED",
        catalogSaved: true,
        searchIndex: "PENDING",
        message: "Catalog saved. Search index will catch up.",
      },
    }),
  );
  await page.route(api + `/admin/movies/${movie.movieId}/schedule`, (r) => {
    schedules++;
    return r.fulfill({ json: { ...movie, publicationStatus: "SCHEDULED" } });
  });
  await page.goto("/admin/movies");
  await page.getByLabel("Title", { exact: true }).fill(movie.title);
  await page.getByLabel("Description").fill(movie.description);
  await page.getByLabel("Genres").fill("Sci-Fi");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByText("Check the metadata")).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    movie.title,
  );
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByText("Draft created")).toBeVisible();
  await page.getByLabel("Publication time").fill("2000-01-01T12:00");
  await page.getByRole("button", { name: "Schedule publish" }).click();
  await expect(
    page.getByText("Choose a publication time in the future."),
  ).toBeVisible();
  expect(schedules).toBe(0);
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(
    page.getByText("Catalog saved. Search index will catch up."),
  ).toBeVisible();
});
test("edit loads the admin draft and saves PATCH", async ({ page }) => {
  await login(page, true);
  let patched = false;
  await page.route(api + `/admin/movies/${movie.movieId}`, (r) => {
    if (r.request().method() === "PATCH") {
      expect(r.request().postDataJSON().title).toBe("New title");
      patched = true;
    }
    return r.fulfill({
      json: { ...movie, title: patched ? "New title" : movie.title },
    });
  });
  await page.goto(`/admin/movies/${movie.movieId}/edit`);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    movie.title,
  );
  await page.getByLabel("Title", { exact: true }).fill("New title");
  await page.getByRole("button", { name: "Save movie" }).click();
  await expect(page.getByText("Movie saved", { exact: true })).toBeVisible();
  expect(patched).toBe(true);
});
test("non-admin cannot load or submit the movie editor", async ({ page }) => {
  await login(page);
  let requests = 0;
  await page.route(api + "/admin/movies**", (r) => {
    requests++;
    return r.fulfill({ json: movie });
  });
  await page.goto(`/admin/movies/${movie.movieId}/edit`);
  await expect(page.getByText("Forbidden", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save movie" })).toHaveCount(0);
  expect(requests).toBe(0);
});
test("movie search requires two characters and debounces detail links", async ({
  page,
}) => {
  const queries: string[] = [];
  await page.route(api + "/movies/search?**", (r) => {
    queries.push(new URL(r.request().url()).searchParams.get("q")!);
    return r.fulfill({ json: { hits: [movie] } });
  });
  await page.goto("/movies/search");
  await page.waitForTimeout(400);
  expect(queries).toEqual([]);
  const input = page.getByPlaceholder("Search (min 2 chars)…");
  await input.fill("i");
  await page.waitForTimeout(400);
  expect(queries).toEqual([]);
  await input.fill("in");
  await input.fill("int");
  await expect(page.getByRole("link", { name: movie.title })).toHaveAttribute(
    "href",
    "/movies/" + movie.movieId,
  );
  expect(queries).toEqual(["int"]);
});
test("detail and watchlist add/remove use gateway and retain failed removal", async ({
  page,
}) => {
  await login(page);
  let saved = false,
    failRemoval = true;
  await page.route(api + "/movies/" + movie.movieId, (r) =>
    r.fulfill({ json: { ...movie, publicationStatus: "PUBLISHED" } }),
  );
  await page.route(api + "/movies/" + movie.movieId + "/media-access", (r) =>
    r.fulfill({
      status: 503,
      json: { message: "Media pipeline is not enabled" },
    }),
  );
  await page.route(api + "/watchlist", (r) =>
    r.fulfill({
      json: saved
        ? [
            {
              movieId: movie.movieId,
              title: movie.title,
              posterKey: "poster.jpg",
            },
          ]
        : [],
    }),
  );
  await page.route(api + "/movies/" + movie.movieId + "/watchlist", (r) => {
    if (r.request().method() === "POST") {
      saved = true;
      return r.fulfill({ json: { ok: true } });
    }
    if (failRemoval)
      return r.fulfill({ status: 503, json: { message: "Try removal again" } });
    saved = false;
    return r.fulfill({ status: 204 });
  });
  await page.goto("/movies/" + movie.movieId);
  await expect(page.getByRole("heading", { name: movie.title })).toBeVisible();
  await page.getByRole("button", { name: "Add to watchlist" }).click();
  await expect(
    page.getByRole("button", { name: "Remove from watchlist" }),
  ).toBeVisible();
  await page.goto("/watchlist");
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText("Try removal again")).toBeVisible();
  await expect(page.getByRole("link", { name: movie.title })).toBeVisible();
  failRemoval = false;
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText("Watchlist is empty")).toBeVisible();
});
test("anonymous detail has watch modes and watchlist redirects to login", async ({
  page,
}) => {
  await page.route(api + "/movies/" + movie.movieId, (r) =>
    r.fulfill({ json: { ...movie, publicationStatus: "PUBLISHED" } }),
  );
  await page.goto("/movies/" + movie.movieId);
  await expect(page.getByRole("heading", { name: "Watch solo" })).toBeVisible();
  await expect(page.getByText("Private or public room")).toBeVisible();
  await page.getByRole("link", { name: "Sign in to add to watchlist" }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto("/watchlist");
  await expect(page).toHaveURL(/login/);
});
