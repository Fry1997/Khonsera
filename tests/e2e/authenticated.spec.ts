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

test("new traveller can create an account through the real signup form", async ({ page }, testInfo) => {
  test.skip(
    !supabaseUrl || !serviceRoleKey,
    "Signup E2E requires the isolated local Supabase environment.",
  );

  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const email = `khonsera-signup-${projectSlug}-${randomUUID()}@example.test`;
  let userId: string | undefined;
  const browserErrors = collectBrowserErrors(page);

  try {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /let's set you up/i })).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page);

    await page.getByLabel("Name").fill("Synthetic Traveller");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(testPassword);
    await page.getByRole("button", { name: /create account/i }).click();

    // Fresh public signups are authenticated but intentionally not approved
    // while Khonsera remains staff-gated. The app route redirects them to the
    // signed-in gated state on the public front door.
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: /your place is reserved/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page);

    const { data: users, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    expect(listError, listError?.message).toBeNull();
    const created = users.users.find((user) => user.email === email);
    expect(created).toBeTruthy();
    userId = created?.id;
    expect(created?.user_metadata?.full_name).toBe("Synthetic Traveller");

    expect.soft(browserErrors, `Browser errors: ${browserErrors.join("\n")}`).toEqual([]);
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});


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
    const origin = new URL(page.url()).origin;

    // Staff demo mode is Khonsera's production-isolated sample itinerary. Put
    // that boundary in place before submitting because login redirects straight
    // to /today; otherwise a brand-new empty account can race into /welcome.
    await context.addCookies([
      {
        name: "journies_demo_mode",
        value: "on",
        url: origin,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(testPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/today(?:\?.*)?$/);

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

    // Navigate's initial planning surface is client-side and does not require
    // additional application tables, so it can be exercised against the same
    // isolated Auth/RLS fixture without manufacturing backend dependencies.
    await page.goto("/navigate");
    await expect.soft(page.getByRole("heading", { name: /point to point/i })).toBeVisible();
    await expect.soft(page.getByText("From", { exact: true })).toBeVisible();
    await expect.soft(page.getByText("To", { exact: true })).toBeVisible();
    await expect.soft(page.getByRole("button", { name: "Walk" })).toBeVisible();
    await expect.soft(page.getByRole("button", { name: "Cycle" })).toBeVisible();
    await expect.soft(page.getByRole("button", { name: "Drive" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAccessibilityViolations(page);
    await page.screenshot({
      path: `test-results/visual-evidence/${projectSlug}-navigate.png`,
      fullPage: true,
    });

    expect.soft(browserErrors, `Browser errors: ${browserErrors.join("\n")}`).toEqual([]);
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});


test("Today replaces a booked rail platform with the live Darwin platform", async ({
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
  const email = `khonsera-e2e-live-platform-${projectSlug}-${randomUUID()}@example.test`;
  let userId: string | undefined;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Khonsera Rail E2E" },
    });
    expect(createError, createError?.message).toBeNull();
    userId = created.user?.id;
    expect(userId).toBeTruthy();

    const { error: profileError } = await admin
      .from("profiles")
      .update({ is_staff: true })
      .eq("id", userId!);
    expect(profileError, profileError?.message).toBeNull();

    await page.goto("/login");
    const origin = new URL(page.url()).origin;

    // The login action immediately redirects to /today. Enable demo mode first
    // so onboarding for the empty throwaway account cannot race the rail check.
    await context.addCookies([
      {
        name: "journies_demo_mode",
        value: "on",
        url: origin,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(testPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/today(?:\?.*)?$/);

    await page.route("**/api/darwin/departure**", async (route) => {
      const url = new URL(route.request().url());
      const crs = url.searchParams.get("crs");
      if (crs === "WEL") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            available: true,
            status: "on_time",
            label: "On time",
            detail: "Platform 5",
            platform: "5",
            destination: "Luton",
          }),
        });
        return;
      }
      if (crs === "LUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            available: true,
            status: "on_time",
            label: "On time",
            detail: "Platform 4",
            platform: "4",
            destination: "Harpenden",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ available: false }),
      });
    });

    await page.goto("/today");
    await expect(page.getByText("Platform 5", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/towards Luton/i).first()).toBeVisible();
    expect(await page.getByText("Platform 2", { exact: true }).count()).toBe(0);
    await page.screenshot({
      path: `test-results/visual-evidence/${projectSlug}-today-live-platform.png`,
      fullPage: true,
    });
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});

test("Today does not present static On time as current when Darwin is unavailable", async ({
  page,
  context,
}, testInfo) => {
  test.fail(
    true,
    "Known rail-trust defect #66: unavailable Darwin currently leaves the static On time state standing.",
  );
  test.skip(
    !supabaseUrl || !serviceRoleKey,
    "Authenticated E2E requires the isolated local Supabase environment.",
  );

  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const email = `khonsera-e2e-live-unavailable-${projectSlug}-${randomUUID()}@example.test`;
  let userId: string | undefined;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Khonsera Rail E2E" },
    });
    expect(createError, createError?.message).toBeNull();
    userId = created.user?.id;
    expect(userId).toBeTruthy();

    const { error: profileError } = await admin
      .from("profiles")
      .update({ is_staff: true })
      .eq("id", userId!);
    expect(profileError, profileError?.message).toBeNull();

    await page.goto("/login");
    const origin = new URL(page.url()).origin;

    // The login action immediately redirects to /today. Enable demo mode first
    // so onboarding for the empty throwaway account cannot race the rail check.
    await context.addCookies([
      {
        name: "journies_demo_mode",
        value: "on",
        url: origin,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(testPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/today(?:\?.*)?$/);
    await page.route("**/api/darwin/departure**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ available: false }),
      });
    });

    await page.goto("/today");
    await expect(page.getByText("On time", { exact: true }).first()).toBeVisible();
    await page.screenshot({
      path: `test-results/visual-evidence/${projectSlug}-today-live-unavailable.png`,
      fullPage: true,
    });
    await expect(
      page.getByText(/live (data|status) unavailable|scheduled only|live status stale/i).first(),
    ).toBeVisible();
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
