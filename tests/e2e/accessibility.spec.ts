import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );

  expect(
    blocking,
    blocking
      .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`)
      .join("\n"),
  ).toEqual([]);
}

test("login has no serious or critical WCAG violations", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

test("deployed landing page passes the same accessibility gate", async ({ page }) => {
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL,
    "Landing auth lookup needs a configured preview/production environment.",
  );

  await page.goto("/");
  await expectNoSeriousAccessibilityViolations(page);
});
