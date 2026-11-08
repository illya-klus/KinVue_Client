import { test, expect } from "@playwright/test";

test("homepage shows KinVue", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "KinVue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse movies" })).toBeVisible();
});
