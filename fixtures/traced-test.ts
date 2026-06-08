/**
 * traced-test.ts — extends the base Playwright test with live screenshot capture.
 *
 * Every time the browser navigates (page load / SPA route change), a screenshot
 * is written to LIVE_SHOT_PATH. The dashboard polls /api/screenshot to display it.
 */

import { test as base, Page, expect } from "@playwright/test";
import os from "os";
import path from "path";

export const LIVE_SHOT_PATH = path.join(os.tmpdir(), "e2e-live-screenshot.png");

async function snap(page: Page) {
  try {
    await page.screenshot({ path: LIVE_SHOT_PATH, type: "png", fullPage: false });
  } catch {
    // page may be closed/navigating — ignore
  }
}

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    // Capture on every load event (covers goto + SPA navigations)
    page.on("load", () => { snap(page); });

    // Also capture after each Playwright action completes
    // by hooking into the page's network idle state indirectly
    // via domcontentloaded (fires on dynamic route changes too)
    page.on("domcontentloaded", () => { snap(page); });

    await use(page);

    // Final screenshot when test ends
    await snap(page);
  },
});

export { expect };
