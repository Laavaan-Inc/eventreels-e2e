/**
 * traced-test.ts
 *
 * Extends the Playwright page fixture so the dashboard can show a live
 * screenshot of every test step as it happens.
 *
 * Strategy: poll page.screenshot() every 400 ms while the test runs.
 * This captures every fill(), click(), goto(), etc. without wrapping
 * individual locator methods — and works for all existing specs as-is.
 *
 * To show a secondary browser (e.g. a guest context) in the live panel,
 * set (globalThis as any).__e2eLivePaused = true before opening the guest
 * page, then run your own snap() loop against the guest Page, and reset to
 * false when done.  globalThis is guaranteed to be shared within the same
 * Playwright worker process regardless of module isolation.
 */

import { test as base, Page, expect } from "@playwright/test";
import fs   from "fs";
import os   from "os";
import path from "path";

export const LIVE_SHOT_PATH = path.join(os.tmpdir(), "e2e-live-screenshot.png");

const POLL_MS = 400;

export async function snap(page: Page) {
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
    // Take an immediate shot when a navigation completes (skip if guest step active)
    page.on("load", () => {
      if (!(globalThis as any).__e2eLivePaused) snap(page);
    });

    // Poll continuously — skip ticks while a guest step owns the live feed
    let running = true;
    const interval = setInterval(async () => {
      if (running && !(globalThis as any).__e2eLivePaused && !page.isClosed()) {
        await snap(page);
      }
    }, POLL_MS);

    await use(page);

    running = false;
    clearInterval(interval);
    await snap(page);
  },
});

export { expect };
