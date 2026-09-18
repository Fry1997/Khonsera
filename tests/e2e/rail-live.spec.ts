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
  const slug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  await withDemoRailUser(page, context, `no-platform-${slug}`, async () => {
    await page.route("**/api/darwin/departure**", async (route) => {
      const url = new URL(route.request().url());
      const crs = url.searchParams.get("crs");

      if (crs === "WEL") {
        // Keep the first live lookup in flight long enough to prove the booked
        // platform never flashes as current while Darwin is being checked.
        await new Promise((resolve) => setTimeout(resolve, 350));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            available: true,
            status: "on_time",
            label: "On time",
            platformAvailable: false,
            source: "darwin",
            generatedAt: "2026-09-18T08:14:30Z",
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

    await expect(
      page.getByText(/live platform unavailable|platform not (shown|announced|available)/i).first(),
    ).toBeVisible();
    await expect(page.getByText(/towards Luton/i).first()).toBeVisible();
    await expect(page.getByText("Platform 2", { exact: true })).toHaveCount(0);

    await page.screenshot({
      path: `test-results/visual-evidence/${slug}-today-live-no-platform.png`,
      fullPage: true,
    });
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


test("Today presents Darwin No report as unavailable live forecast, not Delayed", async ({
  page,
  context,
}, testInfo) => {
  const slug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  await withDemoRailUser(page, context, `no-report-${slug}`, async () => {
    await page.route("**/api/darwin/departure**", async (route) => {
      const url = new URL(route.request().url());
      const crs = url.searchParams.get("crs");

      if (crs === "WEL") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            available: true,
            status: "stale",
            label: "No live report",
            detail: "Platform 5",
            platform: "5",
            destination: "Luton",
            etd: "No report",
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

    await expect(page.getByText("No live report", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Platform 5", { exact: true }).first()).toBeVisible();
    expect(await page.getByText("Delayed", { exact: true }).count()).toBe(0);

    await page.screenshot({
      path: `test-results/visual-evidence/${slug}-today-live-no-report.png`,
      fullPage: true,
    });
  });
});

test("Today makes an uncertain Darwin absolute forecast explicit", async ({
  page,
  context,
}, testInfo) => {
  const slug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  await withDemoRailUser(page, context, `uncertain-${slug}`, async () => {
    await page.route("**/api/darwin/departure**", async (route) => {
      const url = new URL(route.request().url());
      const crs = url.searchParams.get("crs");

      if (crs === "WEL") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            available: true,
            status: "stale",
            label: "Expected 02:07 · uncertain",
            detail: "+8 min · Platform 5",
            platform: "5",
            destination: "Luton",
            etd: "02:07*",
            uncertain: true,
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
      page.getByText("Expected 02:07 · uncertain", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText(/\+8 min/).first()).toBeVisible();
    await expect(page.getByText("Platform 5", { exact: true }).first()).toBeVisible();

    await page.screenshot({
      path: `test-results/visual-evidence/${slug}-today-live-uncertain.png`,
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
