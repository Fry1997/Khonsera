import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const desktopMagicLink = process.env.KHONSERA_QA_MAGIC_LINK_DESKTOP;
const mobileMagicLink = process.env.KHONSERA_QA_MAGIC_LINK_MOBILE;
const productionMode = process.env.KQA_PRODUCTION === "1";
const qaSupabaseUrl = process.env.KQA_SUPABASE_URL;
const qaSupabasePublishableKey = process.env.KQA_SUPABASE_PUBLISHABLE_KEY;
const runNumber = process.env.KQA_RUN_NUMBER ?? "local";

type BrowserSignals = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  serverErrors: string[];
};

type KqaMetrics = {
  scenario: "KQA-UX-001";
  project: string;
  target: string;
  runNumber: string;
  authenticatedTodayMs: number;
  todayToPlanMs: number;
  createPlanMs: number;
  addCommitmentMs: number;
  addRailRunMs: number;
  planToTodayMs: number;
  planName: string;
  journeyDate: string;
  firstViewportAfterBuild: string[];
  browserSignals: BrowserSignals;
  notes: string[];
};

test.skip(
  !productionMode ||
    !desktopMagicLink ||
    !mobileMagicLink ||
    !qaSupabaseUrl ||
    !qaSupabasePublishableKey,
  "KQA-UX-001 only runs from the production QA Observatory workflow.",
);

function londonParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPart["type"]) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function londonYmd(offsetDays = 0) {
  const now = new Date();
  const shifted = new Date(now.getTime() + offsetDays * 86_400_000);
  const p = londonParts(shifted);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

function hhmm(totalMinutes: number) {
  const mins = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}

function scenarioClock() {
  const now = londonParts();
  const current = now.hour * 60 + now.minute;
  const useTomorrow = current > 20 * 60;
  if (useTomorrow) {
    return {
      date: londonYmd(1),
      depart: "07:25",
      changeArrive: "07:58",
      changeDepart: "08:03",
      arrive: "08:18",
      commitment: "08:33",
      leave: "09:30",
    };
  }

  const depart = Math.ceil((current + 45) / 5) * 5;
  return {
    date: londonYmd(0),
    depart: hhmm(depart),
    changeArrive: hhmm(depart + 28),
    changeDepart: hhmm(depart + 33),
    arrive: hhmm(depart + 48),
    commitment: hhmm(depart + 63),
    leave: hhmm(depart + 123),
  };
}

function collectSignals(page: Page): BrowserSignals {
  const signals: BrowserSignals = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    serverErrors: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") signals.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => signals.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    signals.failedRequests.push(
      `${request.method()} ${request.url()} · ${request.failure()?.errorText ?? "failed"}`,
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      signals.serverErrors.push(
        `${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }
  });

  return signals;
}

type SupabaseCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

function normaliseSameSite(
  value: CookieOptions["sameSite"] | undefined,
): "Strict" | "Lax" | "None" | undefined {
  if (value === "strict") return "Strict";
  if (value === "lax") return "Lax";
  if (value === "none") return "None";
  return undefined;
}

async function cookiesForSession(accessToken: string, refreshToken: string) {
  const jar = new Map<string, SupabaseCookie>();

  const supabase = createServerClient(
    qaSupabaseUrl!,
    qaSupabasePublishableKey!,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: true,
      },
      cookies: {
        getAll() {
          return Array.from(jar.values()).map(({ name, value }) => ({
            name,
            value,
          }));
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            jar.set(cookie.name, cookie);
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  expect(error, "Supabase should accept the QA magic-link session").toBeNull();

  return Array.from(jar.values())
    .filter((cookie) => cookie.value)
    .map(({ name, value, options }) => {
      const sameSite = normaliseSameSite(options?.sameSite);
      return {
        name,
        value,
        url: "https://www.khonsera.com",
        httpOnly: options?.httpOnly ?? false,
        secure: options?.secure ?? true,
        ...(sameSite ? { sameSite } : {}),
      };
    });
}

async function authenticateWithoutRecording(
  browser: Browser,
  context: BrowserContext,
  magicLink: string,
) {
  const authContext = await browser.newContext();

  try {
    const authPage = await authContext.newPage();
    await authPage.goto(magicLink, { waitUntil: "domcontentloaded" });

    await authPage.waitForURL(
      (url) =>
        url.hostname === "www.khonsera.com" &&
        url.hash.includes("access_token=") &&
        url.hash.includes("refresh_token="),
      { timeout: 20_000 },
    );

    const hash = new URL(authPage.url()).hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    expect(accessToken, "QA magic link should yield an access token").toBeTruthy();
    expect(refreshToken, "QA magic link should yield a refresh token").toBeTruthy();

    const cookies = await cookiesForSession(accessToken!, refreshToken!);
    expect(
      cookies.length,
      "Supabase SSR should serialise the QA session into cookies",
    ).toBeGreaterThan(0);

    await context.addCookies(cookies);
  } finally {
    await authContext.close();
  }
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
      ".cc-plan-state",
      ".cc-pass-today-status",
      ".cc-pass-consequence",
      ".kh-movement-card",
      ".kh-anchor-card",
      ".kh-change-card",
    ].join(",");

    const seen = new Set<string>();
    const rows: Array<{ top: number; text: string }> = [];

    for (const node of Array.from(document.querySelectorAll<HTMLElement>(selectors))) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = node.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
      const text = (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 220 || seen.has(text)) continue;
      seen.add(text);
      rows.push({ top: Math.round(rect.top), text });
    }

    return rows
      .sort((a, b) => a.top - b.top)
      .slice(0, 45)
      .map((row) => row.text);
  });
}

async function navigateViaShell(
  page: Page,
  href: string,
  notes: string[],
  ready: () => Promise<void>,
) {
  const start = Date.now();
  const visibleLink = page.locator(`a[href="${href}"]:visible`).first();
  if ((await visibleLink.count()) > 0) {
    await visibleLink.click();
  } else {
    notes.push(`No visible shell link for ${href}; test used direct navigation.`);
    await page.goto(href);
  }
  await ready();
  return Date.now() - start;
}

async function openAddSheet(page: Page) {
  const trigger = page.getByRole("button", { name: "Add", exact: true }).first();
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: /what would you like to add/i,
  });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function pickHub(
  dialog: Locator,
  triggerName: RegExp,
  query: string,
  optionName: RegExp,
) {
  await dialog.getByRole("button", { name: triggerName }).click();
  const search = dialog.getByPlaceholder(
    /Wellingborough, Liverpool Lime Street/i,
  );
  await expect(search).toBeVisible();
  await search.fill(query);
  const option = dialog.getByRole("option").filter({ hasText: optionName }).first();
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();
}

test("KQA-UX-001 · persistent production traveller builds a tight rail day", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);

  const signals = collectSignals(page);
  const notes: string[] = [];
  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const clock = scenarioClock();
  const planName = `KQA-UX-001 · Harpenden tight connection · ${runNumber} · ${projectSlug}`;
  const commitmentName = "Project review — KQA-UX-001";

  mkdirSync("test-results/traveller-audit", { recursive: true });
  mkdirSync("test-results/visual-evidence", { recursive: true });

  const magicLink =
    testInfo.project.name === "mobile-390" ? mobileMagicLink! : desktopMagicLink!;
  await authenticateWithoutRecording(browser, context, magicLink);

  const authStart = Date.now();
  await page.goto("/today", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /right now/i })).toBeVisible({
    timeout: 20_000,
  });
  const authenticatedTodayMs = Date.now() - authStart;

  await page.screenshot({
    path: `test-results/visual-evidence/${projectSlug}-kqa-ux-001-start.png`,
    fullPage: true,
  });

  const todayToPlanMs = await navigateViaShell(page, "/plan", notes, async () => {
    await expect(
      page.getByRole("heading", { name: /what are you planning/i }),
    ).toBeVisible();
  });

  const createTrigger = page
    .getByRole("button", { name: /plan something|plan a day/i })
    .first();
  await expect(createTrigger).toBeVisible();
  await createTrigger.click();

  const createDialog = page.getByRole("dialog", {
    name: /when does it start/i,
  });
  await expect(createDialog).toBeVisible();
  await createDialog.locator('input[type="date"]').fill(clock.date);
  await createDialog
    .getByPlaceholder(/Khonsera will name it from the first place/i)
    .fill(planName);

  const createStart = Date.now();
  await createDialog.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page).toHaveURL(/\/plan\/[0-9a-f-]+(?:[?#].*)?$/i, {
    timeout: 20_000,
  });
  await expect(page.getByText(planName, { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
  const createPlanMs = Date.now() - createStart;

  let dialog = await openAddSheet(page);
  await dialog.getByRole("button", { name: "Appointment", exact: true }).click();
  await dialog.getByLabel("What").fill(commitmentName);
  await dialog.getByLabel("Arrive by").fill(clock.commitment);
  await dialog.getByLabel("Leave by").fill(clock.leave);

  const commitmentStart = Date.now();
  await dialog.getByRole("button", { name: "Add it", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect(
    page.getByText(commitmentName, { exact: false }).first(),
  ).toBeVisible({ timeout: 20_000 });
  const addCommitmentMs = Date.now() - commitmentStart;

  dialog = await openAddSheet(page);
  await dialog.getByRole("button", { name: "Transport", exact: true }).click();
  await dialog.getByRole("button", { name: "Train", exact: true }).click();

  await pickHub(dialog, /From station/i, "Wellingborough", /Wellingborough.*WEL/i);
  await pickHub(dialog, /To station/i, "Harpenden", /Harpenden.*HPD/i);

  await dialog.locator('input[type="date"]').fill(clock.date);
  await dialog.getByLabel("Depart", { exact: true }).fill(clock.depart);
  await dialog.getByLabel("Arrive", { exact: true }).first().fill(clock.arrive);

  await dialog.getByRole("button", { name: /add changeover/i }).click();
  await pickHub(dialog, /Changeover station/i, "Luton", /^Luton\b/i);
  await dialog.getByLabel("Arrive", { exact: true }).nth(1).fill(clock.changeArrive);
  await dialog.getByLabel("Depart onward", { exact: true }).fill(clock.changeDepart);

  const railStart = Date.now();
  await dialog.getByRole("button", { name: "Add it", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 25_000 });
  await expect(page.getByText(/Wellingborough/i).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/Harpenden/i).first()).toBeVisible({
    timeout: 20_000,
  });
  const addRailRunMs = Date.now() - railStart;

  const firstViewportAfterBuild = await captureFirstViewport(page);

  await page.screenshot({
    path: `test-results/visual-evidence/${projectSlug}-kqa-ux-001-plan-built.png`,
    fullPage: true,
  });

  const planToTodayMs = await navigateViaShell(page, "/today", notes, async () => {
    await expect(
      page.getByRole("heading", { name: /right now/i }),
    ).toBeVisible({ timeout: 20_000 });
  });

  await page.screenshot({
    path: `test-results/visual-evidence/${projectSlug}-kqa-ux-001-today-after-plan.png`,
    fullPage: true,
  });

  const metrics: KqaMetrics = {
    scenario: "KQA-UX-001",
    project: testInfo.project.name,
    target: "https://www.khonsera.com",
    runNumber,
    authenticatedTodayMs,
    todayToPlanMs,
    createPlanMs,
    addCommitmentMs,
    addRailRunMs,
    planToTodayMs,
    planName,
    journeyDate: clock.date,
    firstViewportAfterBuild,
    browserSignals: signals,
    notes,
  };

  writeFileSync(
    `test-results/traveller-audit/${projectSlug}.json`,
    JSON.stringify(metrics, null, 2),
  );

  console.log("KQA_UX_001 " + JSON.stringify(metrics));

  expect.soft(authenticatedTodayMs, "Authenticated production Today took over 5s").toBeLessThan(5000);
  expect.soft(todayToPlanMs, "Today -> Plan took over 3s").toBeLessThan(3000);
  expect.soft(createPlanMs, "Creating a production plan took over 4s").toBeLessThan(4000);
  expect.soft(addCommitmentMs, "Adding a commitment took over 4s").toBeLessThan(4000);
  expect.soft(addRailRunMs, "Adding the rail run took over 6s").toBeLessThan(6000);
  expect.soft(planToTodayMs, "Plan -> Today took over 3s").toBeLessThan(3000);
  expect.soft(signals.pageErrors, `Page errors: ${signals.pageErrors.join("\n")}`).toEqual([]);
  expect.soft(signals.serverErrors, `5xx responses: ${signals.serverErrors.join("\n")}`).toEqual([]);
});
