/**
 * profile.spec.ts — Profile page tab navigation
 */

import { test } from "../fixtures/traced-test";
import { ProfilePage }  from "../page-objects/ProfilePage";
import { getSeededEvents } from "../utils/api-helpers";

test.describe("Profile tabs", () => {
  test("Date TBD tab is visible", async ({ page }) => {
    const s = getSeededEvents();
    const p = new ProfilePage(page);
    await p.navigate(s.organizerUsername);
    await p.expectTabExists("tbd-events");
  });

  test("Hosting tab shows fixed-date event", async ({ page }) => {
    const s = getSeededEvents();
    const p = new ProfilePage(page);
    await p.navigate(s.organizerUsername);
    await p.selectTab("hosting-events");
    await p.expectEventVisible("E2E Free Event");
  });

  test("Upcoming tab does NOT show dateUndecided event", async ({ page }) => {
    const s = getSeededEvents();
    const p = new ProfilePage(page);
    await p.navigate(s.organizerUsername);
    await p.selectTab("upcoming-events");
    await p.expectEventNotVisible("E2E Date TBD Event");
  });

  test("Date TBD tab shows dateUndecided hosted event", async ({ page }) => {
    const s = getSeededEvents();
    const p = new ProfilePage(page);
    await p.navigate(s.organizerUsername);
    await p.selectTab("tbd-events");
    await p.expectEventVisible("E2E Date TBD Event");
  });

  test("Date TBD tab shows Hosting badge", async ({ page }) => {
    const s = getSeededEvents();
    const p = new ProfilePage(page);
    await p.navigate(s.organizerUsername);
    await p.selectTab("tbd-events");
    await p.expectBadge("Hosting");
  });

  test("Hosting tab does NOT show dateUndecided event", async ({ page }) => {
    const s = getSeededEvents();
    const p = new ProfilePage(page);
    await p.navigate(s.organizerUsername);
    await p.selectTab("hosting-events");
    await p.expectEventNotVisible("E2E Date TBD Event");
  });

  test("Past tab does NOT show dateUndecided event", async ({ page }) => {
    const s = getSeededEvents();
    const p = new ProfilePage(page);
    await p.navigate(s.organizerUsername);
    await p.selectTab("past-events");
    await p.expectEventNotVisible("E2E Date TBD Event");
  });
});
