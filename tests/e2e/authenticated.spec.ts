import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const testPassword = "Khonsera-E2E-Only-2026!";

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  return errors;
}

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );

  expect.soft(
    blocking,
    blocking
      .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`)
      .join("\n"),
  ).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect.soft(hasHorizontalOverflow).toBe(false);
}

test("authenticated staff can use the real shell with isolated demo travel data", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    !supabaseUrl || !serviceRoleKey,
    "Authenticated E2E requires the isolated local Supabase environment.",
  );

  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const email = `khonsera-e2e-${projectSlug}-${randomUUID()}@example.test`;
  let userId: string | undefined;

  mkdirSync("test-results/visual-evidence", { recursive: true });

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Khonsera E2E" },
    });

    expect(createError, createError?.message).toBeNull();
    expect(created.user).toBeTruthy();
    userId = created.user!.id;

    // The application is intentionally staff-gated while it is pre-release.
    // Elevate only this throwaway local user; the local Supabase instance is
    // destroyed at the end of the CI job and never touches production data.
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .update({ is_staff: true })
      .eq("id", userId)
      .select("id, is_staff")
      .single();

    expect(profileError, profileError?.message).toBeNull();
    expect(profile?.is_staff).toBe(true);

    const browserErrors = collectBrowserErrors(page);

    // Exercise the same sign-in form a real user uses. This proves browser
    // cookies, Supabase Auth, the provisioning trigger and the app access gate
    // work together instead of bypassing authentication with injected state.
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(testPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/today(?:\?.*)?$/);

    // Staff demo mode is Khonsera's production-isolated sample itinerary. It
    // renders through the real Today components without reading or mutating the
    // signed-in user's travel records.
    const origin = new URL(page.url()).origin;
    await context.addCookies([
      {
        name: "journies_demo_mode",
        value: "on",
        url: origin,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/today");
    await expect.soft(page.getByRole("heading", { name: /right now/i })).toBeVisible();
    await expect.soft(page.getByText("Demo scenario", { exact: true })).toBeVisible();
    await expect.soft(page.getByText(/project review/i).first()).toBeVisible();
    await expect.soft(page.getByText(/wellingborough/i).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAccessibilityViolations(page);
    await page.screenshot({
      path: `test-results/visual-evidence/${projectSlug}-today.png`,
      fullPage: true,
    });

    // Exercise an authenticated data-backed surface against the real local
    // schema/RLS. A new test account should naturally see the empty Plan state.
    await page.goto("/plan");
    await expect.soft(page.getByRole("heading", { name: /what are you planning/i })).toBeVisible();
    await expect.soft(page.getByText(/nothing planned yet/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAccessibilityViolations(page);
    await page.screenshot({
      path: `test-results/visual-evidence/${projectSlug}-plan.png`,
      fullPage: true,
    });

    expect.soft(browserErrors, `Browser errors: ${browserErrors.join("\n")}`).toEqual([]);
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
