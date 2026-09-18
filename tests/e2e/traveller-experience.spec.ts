import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const testPassword = "Khonsera-E2E-Only-2026!";

type RailMode = "calm" | "delayed";

type AuditMetrics = {
  project: string;
  loginToTodayMs: number;
  coldTodayReadyMs: number;
  coldTodayNavigation: Record<string, number | null>;
  todayToPlanMs: number;
  planToNavigateMs: number;
  navigateToTodayMs: number;
  ticketOpenMs: number;
  ticketTopPx: number | null;
  nextMoveTopPx: number | null;
  firstViewportCalm: string[];
  firstViewportDelayed: string[];
  delayedBodySignals: {
    showsDelay: boolean;
    showsChangedPlatform: boolean;
    stillSaysProtectedSixMinuteChange: boolean;
    mentionsConnectionRisk: boolean;
    mentionsReviewRisk: boolean;
  };
  browserErrors: string[];
};

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function captureFirstViewport(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  return page.evaluate(() => {
    const selectors = [
      "h1",
      "h2",
      "h3",
      "p",
      "button",
      "a",
      "[role='status']",
      ".cc-setoff-move",
      ".cc-setoff-title",
      ".cc-pass-today-time",
      ".cc-pass-today-status",
      ".cc-pass-consequence",
      ".cc-pass-boarding",
      ".kh-movement-card",
      ".kh-anchor-card",
      ".kh-change-card",
    ].join(",");

    const seen = new Set<string>();
    const rows: Array<{ top: number; text: string }> = [];

    for (const node of Array.from(document.querySelectorAll<HTMLElement>(selectors))) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;

      const text = (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 220 || seen.has(text)) continue;

      seen.add(text);
      rows.push({ top: Math.round(rect.top), text });
    }

    return rows
      .sort((a, b) => a.top - b.top)
      .slice(0, 40)
      .map((row) => row.text);
  });
}

async function navigationMetrics(page: Page) {
  await page.waitForLoadState("load");
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const paints = Object.fromEntries(
      performance.getEntriesByType("paint").map((entry) => [entry.name, Math.round(entry.startTime)]),
    );
    return {
      ttfbMs: nav ? Math.round(nav.responseStart - nav.startTime) : null,
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
      loadEventMs: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
      firstPaintMs: typeof paints["first-paint"] === "number" ? paints["first-paint"] : null,
      firstContentfulPaintMs:
        typeof paints["first-contentful-paint"] === "number"
          ? paints["first-contentful-paint"]
          : null,
    };
  });
}

async function clickRoute(
  page: Page,
  href: string,
  urlPattern: RegExp,
  ready: () => Promise<void>,
) {
  const start = Date.now();
  await page.locator(`a[href="${href}"]:visible`).first().click();
  await expect(page).toHaveURL(urlPattern);
  await ready();
  return Date.now() - start;
}

async function createTraveller(
  page: Page,
  context: BrowserContext,
  projectSlug: string,
) {
  test.skip(
    !supabaseUrl || !serviceRoleKey,
    "Traveller audit requires the isolated local Supabase environment.",
  );

  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `khonsera-traveller-audit-${projectSlug}-${randomUUID()}@example.test`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: "Traveller Audit" },
  });

  expect(createError, createError?.message).toBeNull();
  expect(created.user).toBeTruthy();

  const userId = created.user!.id;
  const { error: profileError } = await admin
    .from("profiles")
    .update({ is_staff: true })
    .eq("id", userId);
  expect(profileError, profileError?.message).toBeNull();

  await page.goto("/login");
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

  return { admin, email, userId };
}

function addMinutesToHhmm(value: string | null, minutes: number): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? "");
  if (!match) return null;

  const total =
    (Number(match[1]) * 60 + Number(match[2]) + minutes + 24 * 60) %
    (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function installRailScenario(page: Page, getMode: () => RailMode) {
  return page.route("**/api/darwin/departure**", async (route) => {
    const url = new URL(route.request().url());
    const crs = url.searchParams.get("crs");
    const bookedTime = url.searchParams.get("time");

    if (crs === "WEL") {
      const delayed = getMode() === "delayed";
      const expectedTime = addMinutesToHhmm(bookedTime, 8);
      if (delayed && !expectedTime) {
        throw new Error(`Traveller audit received an invalid booked departure time: ${bookedTime}`);
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          delayed
            ? {
                available: true,
                serviceId: "audit-wel-lut",
                status: "delayed",
                label: `Now ${expectedTime}`,
                detail: "+8 min · Platform 5",
                platform: "5",
                destination: "Luton",
              }
            : {
                available: true,
                serviceId: "audit-wel-lut",
                status: "on_time",
                label: "On time",
                detail: "Platform 2",
                platform: "2",
                destination: "Luton",
              },
        ),
      });
      return;
    }

    if (crs === "LUT") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          available: true,
          serviceId: "audit-lut-hpd",
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
}

test("traveller walkthrough audits speed, orientation and disruption comprehension", async ({
  page,
  context,
}, testInfo) => {
  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const browserErrors = collectBrowserErrors(page);
  let railMode: RailMode = "calm";
  const { admin, email, userId } = await createTraveller(page, context, projectSlug);

  mkdirSync("test-results/traveller-audit", { recursive: true });
  mkdirSync("test-results/visual-evidence", { recursive: true });

  try {
    await installRailScenario(page, () => railMode);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(testPassword);

    const loginStart = Date.now();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/today(?:\?.*)?$/);
    await expect(page.getByRole("heading", { name: /right now/i })).toBeVisible();
    const loginToTodayMs = Date.now() - loginStart;

    // Measure a true route reload once authenticated. This includes the server
    // render, demo-mode boundary, header/weather work and client hydration.
    const coldStart = Date.now();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /right now/i })).toBeVisible();
    await expect(page.getByText("Demo scenario", { exact: true })).toBeVisible();
    await expect(page.getByText(/project review/i).first()).toBeVisible();
    const coldTodayReadyMs = Date.now() - coldStart;
    const coldTodayNavigation = await navigationMetrics(page);

    await page.evaluate(() => window.scrollTo(0, 0));
    const firstViewportCalm = await captureFirstViewport(page);

    const nextMove = page.locator(".cc-today-command").first();
    const nextMoveBox = await nextMove.boundingBox();

    const firstTicketButton = page.getByRole("button", { name: /show ticket/i }).first();
    const ticketButtonBox = await firstTicketButton.boundingBox();

    await page.screenshot({
      path: `test-results/visual-evidence/${projectSlug}-traveller-calm-top.png`,
      fullPage: true,
    });

    const ticketOpenStart = Date.now();
    await firstTicketButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/East Midlands Railway · Wellingborough → Luton/i)).toBeVisible();
    const ticketOpenMs = Date.now() - ticketOpenStart;
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Use the real shell navigation instead of page.goto so this measures the
    // traveller's in-app transition experience.
    const todayToPlanMs = await clickRoute(page, "/plan", /\/plan(?:\?.*)?$/, async () => {
      await expect(page.getByRole("heading", { name: /what are you planning/i })).toBeVisible();
    });

    const planToNavigateMs = await clickRoute(page, "/navigate", /\/navigate(?:\?.*)?$/, async () => {
      await expect(page.getByRole("heading", { name: /point to point/i })).toBeVisible();
    });

    const navigateToTodayMs = await clickRoute(page, "/today", /\/today(?:\?.*)?$/, async () => {
      await expect(page.getByRole("heading", { name: /right now/i })).toBeVisible();
    });

    // Replay the same traveller day with the first train eight minutes late.
    // The planned connection is only six minutes, so this is an experiential
    // stress case: can the traveller still understand what the day means?
    railMode = "delayed";
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(/^Now \d{2}:\d{2}$/, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/\+8 min/).first()).toBeVisible();
    await expect(page.getByText("Platform 5", { exact: true }).first()).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));

    const firstViewportDelayed = await captureFirstViewport(page);
    const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ");

    await page.screenshot({
      path: `test-results/visual-evidence/${projectSlug}-traveller-delayed.png`,
      fullPage: true,
    });

    const metrics: AuditMetrics = {
      project: testInfo.project.name,
      loginToTodayMs,
      coldTodayReadyMs,
      coldTodayNavigation,
      todayToPlanMs,
      planToNavigateMs,
      navigateToTodayMs,
      ticketOpenMs,
      ticketTopPx: ticketButtonBox ? Math.round(ticketButtonBox.y) : null,
      nextMoveTopPx: nextMoveBox ? Math.round(nextMoveBox.y) : null,
      firstViewportCalm,
      firstViewportDelayed,
      delayedBodySignals: {
        showsDelay: /\+8 min/.test(bodyText),
        showsChangedPlatform: /Platform 5/.test(bodyText),
        stillSaysProtectedSixMinuteChange: /protected six-minute change/i.test(bodyText),
        mentionsConnectionRisk: /connection.{0,40}(risk|miss|tight)|(?:risk|miss|tight).{0,40}connection/i.test(
          bodyText,
        ),
        mentionsReviewRisk: /project review.{0,60}(late|risk|miss)|(?:late|risk|miss).{0,60}project review/i.test(
          bodyText,
        ),
      },
      browserErrors,
    };

    writeFileSync(
      `test-results/traveller-audit/${projectSlug}.json`,
      JSON.stringify(metrics, null, 2),
    );
    console.log("TRAVELLER_AUDIT " + JSON.stringify(metrics));

    // Generous ceilings: these are not micro-benchmarks. They flag only a
    // clearly sluggish traveller experience on the same CI hardware used by
    // Khonsera's browser gate.
    expect.soft(loginToTodayMs, "Login -> useful Today took over 4s").toBeLessThan(4000);
    expect.soft(coldTodayReadyMs, "Authenticated cold Today took over 3s").toBeLessThan(3000);
    expect.soft(todayToPlanMs, "Today -> Plan transition took over 2s").toBeLessThan(2000);
    expect.soft(planToNavigateMs, "Plan -> Navigate transition took over 2s").toBeLessThan(2000);
    expect.soft(navigateToTodayMs, "Navigate -> Today transition took over 2s").toBeLessThan(2000);
    expect.soft(ticketOpenMs, "Ticket reveal took over 1s").toBeLessThan(1000);
    expect.soft(browserErrors, `Browser errors: ${browserErrors.join("\n")}`).toEqual([]);
  } finally {
    await admin.auth.admin.deleteUser(userId);
  }
});
