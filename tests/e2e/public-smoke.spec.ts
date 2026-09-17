import { expect, test } from "@playwright/test";

function failOnPageErrors(page: Parameters<typeof test>[0] extends never ? never : any) {
  const errors: string[] = [];

  page.on("pageerror", (error: Error) => errors.push(error.message));
  page.on("console", (message: { type(): string; text(): string }) => {
    if (message.type() === "error") errors.push(message.text());
  });

  return errors;
}

test("login renders cleanly without horizontal overflow", async ({ page }) => {
  const errors = failOnPageErrors(page);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );

  expect(hasHorizontalOverflow).toBe(false);
  expect(errors, `Browser errors: ${errors.join("\n")}`).toEqual([]);
});

test("forgot-password route is reachable", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: /forgot password/i }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
  await expect(page.locator("body")).toBeVisible();
});

test("deployed landing page renders when a real environment is supplied", async ({ page }) => {
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL,
    "Landing auth lookup needs a configured preview/production environment.",
  );

  const errors = failOnPageErrors(page);
  await page.goto("/");
  await expect(page).toHaveTitle(/Khonsera/i);
  await expect(page.getByText(/your travel, quietly handled/i).first()).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );

  expect(hasHorizontalOverflow).toBe(false);
  expect(errors, `Browser errors: ${errors.join("\n")}`).toEqual([]);
});
