import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const testPassword = "Khonsera-E2E-Only-2026!";

async function withDemoRailUser(
  page: Page,
  context: BrowserContext,
  testName: string,
  run: () => Promise<void>,
) {
  test.skip(
    !supabaseUrl || !serviceRoleKey,
    "Rail E2E requires the isolated local Supabase environment.",
  );

  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `khonsera-rail-e2e-${testName}-${randomUUID()}@example.test`;
  let userId: string | undefined;

  mkdirSync("test-results/visual-evidence", { recursive: true });

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

    // Login redirects straight to /today. Put the isolated demo boundary in
    // place before submitting so a brand-new empty user cannot race through
    // /today -> /welcome before the rail fixture becomes active.
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

    await run();
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
}

function normalLutonResponse() {
  return {
    available: true,
    status: "on_time",
    label: "On time",
    detail: "Platform 4",
    platform: "4",
    destination: "Harpenden",
  };
}

test("live service with no platform does not reuse the booked platform as current", async ({
  page,
  context,
}, testInfo) => {
  test.fail(
    true,
    "Known rail-trust defect #71: live no-platform currently falls back to the booked platform.",
  );

  const slug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  await withDemoRailUser(page, context, `no-platform-${slug}`, async () => {
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
            destination: "Luton",
          }),
        });
        return;
      }

      if (crs === "LUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(normalLutonResponse()),
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

    // Characterise the unsafe current behaviour before the expectation that
    // defines the passenger-safe target.
    await expect(page.getByText("Platform 2", { exact: true }).first()).toBeVisible();
    await page.screenshot({
      path: `test-results/visual-evidence/${slug}-today-live-no-platform.png`,
      fullPage: true,
    });

    await expect(
      page.getByText(/platform not (shown|announced|available)|platform unavailable/i).first(),
    ).toBeVisible();
  });
});

test("Today surfaces a live rail cancellation and removes the stale booked platform", async ({
  page,
  context,
}, testInfo) => {
  const slug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  await withDemoRailUser(page, context, `cancelled-${slug}`, async () => {
    await page.route("**/api/darwin/departure**", async (route) => {
      const url = new URL(route.request().url());
      const crs = url.searchParams.get("crs");

      if (crs === "WEL") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            available: true,
            status: "cancelled",
            label: "Cancelled",
            detail: "Operational incident",
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
          body: JSON.stringify(normalLutonResponse()),
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

    await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Operational incident", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Platform 5", { exact: true }).first()).toBeVisible();
    expect(await page.getByText("Platform 2", { exact: true }).count()).toBe(0);

    await page.screenshot({
      path: `test-results/visual-evidence/${slug}-today-live-cancelled.png`,
      fullPage: true,
    });
  });
});

test("Today surfaces a live delay together with a changed platform", async ({
  page,
  context,
}, testInfo) => {
  const slug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  await withDemoRailUser(page, context, `delayed-${slug}`, async () => {
    await page.route("**/api/darwin/departure**", async (route) => {
      const url = new URL(route.request().url());
      const crs = url.searchParams.get("crs");

      if (crs === "WEL") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            available: true,
            status: "delayed",
            label: "Now 02:07",
            detail: "+8 min · Platform 5",
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
          body: JSON.stringify(normalLutonResponse()),
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

    await expect(page.getByText("Now 02:07", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/\+8 min/).first()).toBeVisible();
    await expect(page.getByText("Platform 5", { exact: true }).first()).toBeVisible();
    expect(await page.getByText("Platform 2", { exact: true }).count()).toBe(0);

    await page.screenshot({
      path: `test-results/visual-evidence/${slug}-today-live-delayed.png`,
      fullPage: true,
    });
  });
});

test("Today warns about the other live train leaving the same platform first", async ({
  page,
  context,
}, testInfo) => {
  const slug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  await withDemoRailUser(page, context, `wrong-train-${slug}`, async () => {
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
            earlierSamePlatform: {
              std: "01:55",
              destination: "Corby",
              platform: "5",
            },
          }),
        });
        return;
      }

      if (crs === "LUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(normalLutonResponse()),
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

    await expect(
      page.getByText(/Platform 5 also has the 01:55 to Corby before yours/i).first(),
    ).toBeVisible();

    await page.screenshot({
      path: `test-results/visual-evidence/${slug}-today-live-wrong-train-warning.png`,
      fullPage: true,
    });
  });
});
