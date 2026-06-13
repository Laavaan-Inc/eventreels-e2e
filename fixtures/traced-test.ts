/**
 * traced-test.ts
 *
 * Extends the Playwright page fixture so the dashboard can show a live
 * screenshot of every test step as it happens.
 *
 * Strategy: poll page.screenshot() every 400 ms while the test runs.
 * This captures every fill(), click(), goto(), etc. without wrapping
 * individual locator methods — and works for all existing specs as-is.
 */

import { test as base, Page, expect } from "@playwright/test";
import fs   from "fs";
import os   from "os";
import path from "path";

export const LIVE_SHOT_PATH = path.join(os.tmpdir(), "e2e-live-screenshot.png");

const POLL_MS = 400;

async function snap(page: Page) {
  try {
    if (!page.isClosed()) {
      await page.screenshot({ path: LIVE_SHOT_PATH, type: "png", fullPage: false });
    }
  } catch {
    // page navigating or closed — ignore
  }
}

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    // Take an immediate shot when a navigation completes
    page.on("load", () => snap(page));

    // Poll continuously so every click / fill / etc. is captured
    let running = true;
    const interval = setInterval(async () => {
      if (running && !page.isClosed()) await snap(page);
    }, POLL_MS);

    await use(page);

    running = false;
    clearInterval(interval);
    // Final state after the test
    await snap(page);
  },
});

export { expect };
