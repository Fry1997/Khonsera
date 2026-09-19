import { chromium } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFile = promisify(execFileCb);

const targetUrl = process.env.PLAYWRIGHT_BASE_URL ?? "https://www.khonsera.com";
const magicLink = process.env.KHONSERA_QA_MAGIC_LINK;
const supabaseUrl = process.env.KQA_SUPABASE_URL;
const supabasePublishableKey = process.env.KQA_SUPABASE_PUBLISHABLE_KEY;
const githubToken = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const runId = process.env.GITHUB_RUN_ID;
const viewportName = process.env.KQA_VIEWPORT ?? "desktop-chromium";
const controlBranch = `qa-control-${runId}`;
const controlPath = "qa-control/command.json";
const maxMinutes = Number(process.env.KQA_RELAY_MAX_MINUTES ?? "35");
const maxCommands = Number(process.env.KQA_RELAY_MAX_COMMANDS ?? "80");

for (const [name, value] of Object.entries({
  KHONSERA_QA_MAGIC_LINK: magicLink,
  KQA_SUPABASE_URL: supabaseUrl,
  KQA_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey,
  GITHUB_TOKEN: githubToken,
  GITHUB_REPOSITORY: repository,
  GITHUB_RUN_ID: runId,
})) {
  if (!value) throw new Error(`${name} is required for the QA relay.`);
}

const [owner, repo] = repository.split("/");
if (!owner || !repo) throw new Error("GITHUB_REPOSITORY must be owner/repo.");

const viewport =
  viewportName === "mobile-390"
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false };

const evidenceRoot = path.resolve(
  process.env.KQA_EVIDENCE_DIR ?? `test-results/relay/${viewportName}`,
);
const stepsDir = path.join(evidenceRoot, "steps");
const actionLogPath = path.join(evidenceRoot, "actions.jsonl");
const resultPath = path.join(evidenceRoot, "result.json");
const tracePath = path.join(evidenceRoot, `${viewportName}-trace.zip`);
const videoPath = path.join(evidenceRoot, `${viewportName}.webm`);
const finalShotPath = path.join(evidenceRoot, `${viewportName}-final.png`);
const liveDir = path.resolve("qa-live");
const liveShotPath = path.join(liveDir, "current.png");
const liveStatePath = path.join(liveDir, "state.json");
const liveBranch = `qa-live-${runId}`;
const rawBase = `https://raw.githubusercontent.com/${repository}/${liveBranch}/qa-live`;
const startedAt = new Date();
const deadline = Date.now() + maxMinutes * 60_000;

await mkdir(stepsDir, { recursive: true });
await mkdir(liveDir, { recursive: true });

const signals = {
  consoleErrors: [],
  consoleWarnings: [],
  pageErrors: [],
  failedRequests: [],
  serverErrors: [],
  slowRequests: [],
  blockedNavigations: [],
};

const requestStartedAt = new WeakMap();
const actions = [];
let commandCount = 0;
let lastControlSequence = 0;
let finishPayload = null;
let relayError = null;
let video = null;
let context = null;
let page = null;

function clean(value, max = 1000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function allowedHostname(urlString) {
  try {
    const url = new URL(urlString);
    return ["www.khonsera.com", "khonsera.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function github(method, apiPath, body) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `GitHub API ${method} ${apiPath} failed ${response.status}: ${detail.slice(0, 1200)}`,
    );
  }

  return response.status === 204 ? null : response.json();
}

async function githubResponse(method, apiPath, body) {
  return fetch(`https://api.github.com${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
}

async function ensureControlBranch() {
  const refPath = `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(controlBranch)}`;
  const existing = await githubResponse("GET", refPath);

  if (existing.status === 404) {
    await github("POST", `/repos/${owner}/${repo}/git/refs`, {
      ref: `refs/heads/${controlBranch}`,
      sha: process.env.GITHUB_SHA,
    });
  } else if (!existing.ok) {
    throw new Error(
      `Could not inspect control branch: ${existing.status} ${(await existing.text()).slice(0, 800)}`,
    );
  }
}

async function readControlFile() {
  const apiPath =
    `/repos/${owner}/${repo}/contents/${controlPath}?ref=${encodeURIComponent(controlBranch)}`;
  const response = await githubResponse("GET", apiPath);

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `Could not read control file: ${response.status} ${(await response.text()).slice(0, 800)}`,
    );
  }

  const payload = await response.json();
  const text = Buffer.from(String(payload.content ?? "").replace(/\\n/g, ""), "base64").toString("utf8");
  return { sha: payload.sha, data: JSON.parse(text) };
}

async function seedControlFile() {
  await ensureControlBranch();
  const existing = await readControlFile();
  const body = {
    runId,
    viewport: viewportName,
    sequence: 0,
    command: { type: "screenshot" },
    updatedAt: new Date().toISOString(),
  };

  await github("PUT", `/repos/${owner}/${repo}/contents/${controlPath}`, {
    message: `qa-control: ready ${viewportName}`,
    content: Buffer.from(JSON.stringify(body, null, 2) + "\n", "utf8").toString("base64"),
    branch: controlBranch,
    ...(existing?.sha ? { sha: existing.sha } : {}),
  });
}

async function fetchControlCommand() {
  const current = await readControlFile();
  const data = current?.data;
  if (!data) return null;
  if (String(data.runId) !== String(runId)) return null;
  if (data.viewport !== viewportName) return null;

  const sequence = Number(data.sequence ?? 0);
  if (!Number.isFinite(sequence) || sequence <= lastControlSequence) return null;

  lastControlSequence = sequence;
  return {
    sequence,
    command: data.command,
  };
}

async function ensureLiveBranch() {
  await execFile("git", ["config", "user.name", "github-actions[bot]"]);
  await execFile("git", [
    "config",
    "user.email",
    "41898282+github-actions[bot]@users.noreply.github.com",
  ]);

  const { stdout } = await execFile("git", ["branch", "--show-current"]);
  if (stdout.trim() === liveBranch) return;

  await execFile("git", ["switch", "-C", liveBranch, process.env.GITHUB_SHA]);
}

async function pushLiveState(stepLabel) {
  await ensureLiveBranch();
  await execFile("git", ["add", "-f", "qa-live/current.png", "qa-live/state.json"]);
  await execFile("git", [
    "commit",
    "--allow-empty",
    "-m",
    `qa-live: ${viewportName} ${stepLabel}`,
  ]);
  await execFile("git", [
    "push",
    "--force",
    "origin",
    `HEAD:refs/heads/${liveBranch}`,
  ]);
}

async function capture(page, filePath) {
  const buffer = await page.screenshot({
    path: filePath,
    type: "png",
    animations: "disabled",
  });
  return buffer;
}

async function observeScreen(page) {
  return page.evaluate(() => {
    const inViewport = (element) => {
      const style = window.getComputedStyle(element);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0
      ) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth
      );
    };

    const labelFor = (element) => {
      const aria = element.getAttribute("aria-label");
      if (aria) return aria.trim();

      const labelledBy = element.getAttribute("aria-labelledby");
      if (labelledBy) {
        const text = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.innerText || "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (text) return text;
      }

      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) {
        if (element.labels?.length) {
          const text = Array.from(element.labels)
            .map((label) => label.innerText)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          if (text) return text;
        }
        if (element.placeholder) return element.placeholder.trim();
      }

      return (
        element.getAttribute("title") ||
        element.innerText ||
        element.textContent ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim();
    };

    const interactiveSelector = [
      "button",
      "a[href]",
      "input",
      "textarea",
      "select",
      "[contenteditable='true']",
      "[role='button']",
      "[role='link']",
      "[role='checkbox']",
      "[role='radio']",
      "[role='switch']",
      "[role='tab']",
      "[role='option']",
      "[role='menuitem']",
      "[role='combobox']",
      "[role='textbox']",
      "[role='spinbutton']",
      "[role='slider']",
    ].join(",");

    const interactives = Array.from(
      document.querySelectorAll(interactiveSelector),
    )
      .filter((element) => element instanceof HTMLElement && inViewport(element))
      .map((element, index) => {
        const rect = element.getBoundingClientRect();
        const input = element instanceof HTMLInputElement ? element : null;
        const textarea = element instanceof HTMLTextAreaElement ? element : null;
        const select = element instanceof HTMLSelectElement ? element : null;
        const rawValue =
          input?.type === "password"
            ? "[redacted]"
            : input?.value ?? textarea?.value ?? select?.value ?? null;

        return {
          index,
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute("role"),
          label: labelFor(element).slice(0, 220),
          type: input?.type ?? null,
          value: rawValue == null ? null : String(rawValue).slice(0, 220),
          disabled:
            ("disabled" in element && Boolean(element.disabled)) ||
            element.getAttribute("aria-disabled") === "true",
          checked:
            input &&
            ["checkbox", "radio"].includes(input.type)
              ? input.checked
              : element.getAttribute("aria-checked"),
          center: {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
          },
          box: {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      })
      .slice(0, 120);

    const textSelector = [
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "li",
      "label",
      "button",
      "a",
      "[role='status']",
      "[role='alert']",
      "[role='heading']",
    ].join(",");

    const seen = new Set();
    const viewportText = Array.from(document.querySelectorAll(textSelector))
      .filter((element) => element instanceof HTMLElement && inViewport(element))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const text = (element.innerText || element.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        return {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          text: text.slice(0, 320),
        };
      })
      .filter((row) => {
        if (!row.text || seen.has(row.text)) return false;
        seen.add(row.text);
        return true;
      })
      .sort((a, b) => a.top - b.top || a.left - b.left)
      .slice(0, 120);

    const active = document.activeElement;
    let focused = null;
    if (active instanceof HTMLElement && active !== document.body) {
      const rect = active.getBoundingClientRect();
      focused = {
        tag: active.tagName.toLowerCase(),
        role: active.getAttribute("role"),
        label: labelFor(active).slice(0, 220),
        center: {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
        },
      };
    }

    return {
      viewportText,
      interactives,
      focused,
      scroll: {
        x: Math.round(window.scrollX),
        y: Math.round(window.scrollY),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentWidth: Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth || 0,
        ),
        documentHeight: Math.max(
          document.documentElement.scrollHeight,
          document.body?.scrollHeight || 0,
        ),
      },
    };
  });
}

async function publishState(status, extra = {}) {
  const step = String(commandCount).padStart(3, "0");
  const stepPath = path.join(stepsDir, `step-${step}.png`);
  await capture(page, stepPath);
  await writeFile(liveShotPath, await capture(page), "binary");

  const screen = await observeScreen(page);

  const state = {
    scenario: "KQA-UX-001",
    executionMode: "chat-piloted-relay",
    runId,
    viewportName,
    status,
    commandCount,
    maxCommands,
    startedAt: startedAt.toISOString(),
    updatedAt: new Date().toISOString(),
    url: page.url(),
    title: await page.title().catch(() => ""),
    viewportSize: viewport.viewport,
    liveScreenshot: `${rawBase}/current.png`,
    liveState: `${rawBase}/state.json`,
    controlBranch,
    controlPath,
    lastAction: actions.at(-1) ?? null,
    screen,
    signals: {
      consoleErrors: signals.consoleErrors.slice(-8),
      pageErrors: signals.pageErrors.slice(-8),
      failedRequests: signals.failedRequests.slice(-8),
      serverErrors: signals.serverErrors.slice(-8),
      slowRequests: signals.slowRequests.slice(-8),
      blockedNavigations: signals.blockedNavigations.slice(-8),
    },
    ...extra,
  };

  await writeFile(liveStatePath, JSON.stringify(state, null, 2) + "\n", "utf8");
  await pushLiveState(`${status}-${step}`);
  return state;
}

async function bootstrapSession(browser, targetContext) {
  const authContext = await browser.newContext();

  try {
    const authPage = await authContext.newPage();
    await authPage.goto(magicLink, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    await authPage.waitForURL(
      (url) =>
        url.hostname === "www.khonsera.com" &&
        url.hash.includes("access_token=") &&
        url.hash.includes("refresh_token="),
      { timeout: 25_000 },
    );

    const params = new URLSearchParams(new URL(authPage.url()).hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      throw new Error("QA auth link did not yield a Supabase session.");
    }

    const jar = new Map();
    const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
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
          for (const cookie of cookiesToSet) jar.set(cookie.name, cookie);
        },
      },
    });

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw new Error(`Supabase rejected QA session: ${error.message}`);

    const cookies = Array.from(jar.values())
      .filter((cookie) => cookie.value)
      .map(({ name, value, options = {} }) => ({
        name,
        value,
        url: targetUrl,
        httpOnly: options.httpOnly ?? false,
        secure: options.secure ?? true,
        sameSite:
          options.sameSite === "strict"
            ? "Strict"
            : options.sameSite === "none"
              ? "None"
              : "Lax",
      }));

    if (!cookies.length) {
      throw new Error("Supabase SSR did not serialise the QA session.");
    }

    await targetContext.addCookies(cookies);
    await targetContext.addCookies([
      {
        name: "khonsera_welcomed",
        value: "1",
        url: targetUrl,
        sameSite: "Lax",
        secure: true,
      },
    ]);
  } finally {
    await authContext.close();
  }
}

function normaliseKey(key) {
  const map = {
    CTRL: "Control",
    CONTROL: "Control",
    CMD: "Meta",
    COMMAND: "Meta",
    META: "Meta",
    ALT: "Alt",
    SHIFT: "Shift",
    ENTER: "Enter",
    RETURN: "Enter",
    TAB: "Tab",
    ESC: "Escape",
    ESCAPE: "Escape",
    BACKSPACE: "Backspace",
    DELETE: "Delete",
    ARROWUP: "ArrowUp",
    ARROWDOWN: "ArrowDown",
    ARROWLEFT: "ArrowLeft",
    ARROWRIGHT: "ArrowRight",
    HOME: "Home",
    END: "End",
    PAGEUP: "PageUp",
    PAGEDOWN: "PageDown",
    SPACE: " ",
  };
  return map[String(key).toUpperCase()] ?? String(key);
}

async function executeCommand(command) {
  switch (command.type) {
    case "click":
      await page.mouse.click(Number(command.x), Number(command.y), {
        button: command.button === "right" ? "right" : "left",
      });
      break;
    case "double_click":
      await page.mouse.dblclick(Number(command.x), Number(command.y), {
        button: command.button === "right" ? "right" : "left",
      });
      break;
    case "move":
      await page.mouse.move(Number(command.x), Number(command.y));
      break;
    case "type":
      await page.keyboard.insertText(String(command.text ?? "").slice(0, 2000));
      break;
    case "fill": {
      if (Number.isFinite(Number(command.x)) && Number.isFinite(Number(command.y))) {
        await page.mouse.click(Number(command.x), Number(command.y));
      }
      const active = page.locator(":focus");
      if ((await active.count()) !== 1) {
        throw new Error("fill requires exactly one focused form control.");
      }
      await active.fill(String(command.text ?? "").slice(0, 2000));
      break;
    }
    case "keypress": {
      const keys = Array.isArray(command.keys)
        ? command.keys.map(normaliseKey)
        : [normaliseKey(command.key ?? "")];
      if (!keys.filter(Boolean).length) throw new Error("keypress needs key/keys.");
      await page.keyboard.press(keys.filter(Boolean).join("+"));
      break;
    }
    case "scroll":
      if (Number.isFinite(Number(command.x)) && Number.isFinite(Number(command.y))) {
        await page.mouse.move(Number(command.x), Number(command.y));
      }
      await page.mouse.wheel(
        Number(command.deltaX ?? 0),
        Number(command.deltaY ?? command.yDelta ?? 0),
      );
      break;
    case "wait":
      await page.waitForTimeout(
        Math.min(Math.max(Number(command.ms ?? 1000), 100), 10_000),
      );
      break;
    case "goto": {
      const requested = new URL(String(command.url ?? command.path ?? ""), targetUrl);
      if (!allowedHostname(requested.toString())) {
        throw new Error("goto is restricted to khonsera.com.");
      }
      await page.goto(requested.toString(), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      break;
    }
    case "screenshot":
      break;
    case "finish":
      finishPayload = {
        outcome: clean(command.outcome || "completed", 60),
        summary: clean(command.summary || "", 2000),
        findings: Array.isArray(command.findings) ? command.findings : [],
      };
      break;
    case "abort":
      finishPayload = {
        outcome: "aborted",
        summary: clean(command.summary || "Relay aborted by controller.", 2000),
        findings: [],
      };
      break;
    default:
      throw new Error(`Unsupported relay command type: ${command.type}`);
  }

  if (!["wait", "screenshot", "finish", "abort"].includes(command.type)) {
    await page.waitForTimeout(450);
  }
}

const browser = await chromium.launch({ headless: true });

try {
  context = await browser.newContext({
    viewport: viewport.viewport,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    recordVideo: {
      dir: path.join(evidenceRoot, "video"),
      size: viewport.viewport,
    },
  });

  await context.route("**/*", async (route) => {
    const request = route.request();
    if (
      request.isNavigationRequest() &&
      request.frame() === page?.mainFrame() &&
      request.resourceType() === "document" &&
      !allowedHostname(request.url())
    ) {
      signals.blockedNavigations.push(request.url());
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true,
  });

  page = await context.newPage();
  video = page.video();

  page.on("console", (message) => {
    if (message.type() === "error") {
      signals.consoleErrors.push(clean(message.text(), 800));
    } else if (message.type() === "warning") {
      signals.consoleWarnings.push(clean(message.text(), 800));
    }
  });

  page.on("pageerror", (error) => {
    signals.pageErrors.push(clean(error.message, 800));
  });

  page.on("request", (request) => {
    requestStartedAt.set(request, Date.now());
  });

  page.on("requestfailed", (request) => {
    signals.failedRequests.push(
      `${request.method()} ${request.url()} · ${request.failure()?.errorText ?? "failed"}`,
    );
  });

  page.on("response", (response) => {
    const elapsed =
      Date.now() - (requestStartedAt.get(response.request()) ?? Date.now());

    if (response.status() >= 500) {
      signals.serverErrors.push(
        `${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }

    if (elapsed >= 3000) {
      signals.slowRequests.push(
        `${elapsed}ms ${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }
  });

  await bootstrapSession(browser, context);

  await page.goto(`${targetUrl}/today`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForTimeout(700);

  if (!allowedHostname(page.url())) {
    throw new Error(`QA relay landed outside Khonsera: ${page.url()}`);
  }

  await seedControlFile();
  await publishState("ready");

  while (!finishPayload) {
    if (Date.now() > deadline) {
      throw new Error(`QA relay exceeded ${maxMinutes} minutes for ${viewportName}.`);
    }
    if (commandCount >= maxCommands) {
      throw new Error(`QA relay exceeded ${maxCommands} commands for ${viewportName}.`);
    }

    const pending = await fetchControlCommand();

    if (!pending) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      continue;
    }

    const { sequence, command } = pending;
    const beforeUrl = page.url();
    const before = Date.now();
    let commandError = null;

    try {
      await executeCommand(command);
    } catch (error) {
      commandError = error instanceof Error ? error.message : String(error);
    }

    commandCount += 1;
    const entry = {
      sequence,
      commandNumber: commandCount,
      at: new Date().toISOString(),
      command,
      beforeUrl,
      afterUrl: page.url(),
      durationMs: Date.now() - before,
      error: commandError,
    };
    actions.push(entry);
    await appendFile(actionLogPath, JSON.stringify(entry) + "\n", "utf8");

    await publishState(
      finishPayload ? "finished" : commandError ? "command-error" : "ready",
      commandError ? { commandError } : {},
    );

    if (commandError) {
      console.error(`Relay command ${commandCount} failed: ${commandError}`);
    }
  }

  await publishState("finished", { finish: finishPayload });
  await capture(page, finalShotPath);
} catch (error) {
  relayError = error instanceof Error ? error.message : String(error);
  console.error(relayError);

  if (page) {
    try {
      await publishState("error", { relayError });
      await capture(page, finalShotPath);
    } catch {}
  }
} finally {
  if (context) {
    try {
      await context.tracing.stop({ path: tracePath });
    } catch {}

    try {
      await context.close();
    } catch {}
  }

  if (video) {
    try {
      await video.saveAs(videoPath);
    } catch {}
  }

  await browser.close();
}

const result = {
  scenario: "KQA-UX-001",
  executionMode: "chat-piloted-relay",
  runId,
  viewport: viewportName,
  target: targetUrl,
  liveBranch,
  controlBranch,
  controlPath,
  liveScreenshot: `${rawBase}/current.png`,
  liveState: `${rawBase}/state.json`,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  commandCount,
  finish: finishPayload,
  relayError,
  signals,
};

await writeFile(resultPath, JSON.stringify(result, null, 2) + "\n", "utf8");

console.log(
  "KQA_RELAY_RESULT " +
    JSON.stringify({
      runId,
      viewport: viewportName,
      commandCount,
      outcome: finishPayload?.outcome ?? "relay-error",
      relayError,
    }),
);

if (relayError) process.exitCode = 1;
