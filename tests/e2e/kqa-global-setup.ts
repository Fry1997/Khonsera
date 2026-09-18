import { chromium, type FullConfig } from "@playwright/test";

const magicLink = process.env.KHONSERA_QA_MAGIC_LINK;
const storageStatePath =
  process.env.KQA_STORAGE_STATE ?? "/tmp/khonsera-kqa-auth.json";

export default async function kqaGlobalSetup(config: FullConfig) {
  if (process.env.KQA_PRODUCTION !== "1") return;
  if (!magicLink) {
    throw new Error("KHONSERA_QA_MAGIC_LINK is required for production QA.");
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();

  try {
    const page = await context.newPage();
    await page.goto(magicLink, { waitUntil: "domcontentloaded" });

    await page.waitForURL(
      /https:\/\/www\.khonsera\.com\/(today|welcome)(?:[/?#].*)?$/,
      { timeout: 30_000 },
    );

    if (/\/welcome(?:[/?#]|$)/.test(page.url())) {
      await page
        .getByRole("button", { name: /find me later/i })
        .click();
      await page.waitForURL(
        /https:\/\/www\.khonsera\.com\/today(?:[/?#].*)?$/,
        { timeout: 30_000 },
      );
    }

    await context.storageState({ path: storageStatePath });

    const baseURL = String(config.projects[0]?.use?.baseURL ?? "");
    if (!baseURL.startsWith("https://www.khonsera.com")) {
      throw new Error(
        `Production KQA expected www.khonsera.com, received ${baseURL || "no baseURL"}.`,
      );
    }
  } finally {
    await context.close();
    await browser.close();
  }
}
