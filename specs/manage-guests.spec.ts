/**
 * manage-guests.spec.ts — Guest management flows
 */

import { test, expect } from "@playwright/test";
import { ManageEventPage } from "../page-objects/ManageEventPage";
import { getSeededEvents }  from "../utils/api-helpers";

test.describe("Manage — guests", () => {
  test("Guests & Invites tab loads for fixed event", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();
    const m = new ManageEventPage(page);
    await m.navigate(s.fixedEventId);
    await m.selectTab("guests");
    await m.selectGuestsSubTab("guests");
    await expect(page.getByText(/guests|no guests|attendees/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test("Join Requests tab loads for approval event", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.approvalEventId) test.skip();
    const m = new ManageEventPage(page);
    await m.navigate(s.approvalEventId);
    await m.selectTab("guests");
    await m.selectGuestsSubTab("requests");
    await expect(page.getByText(/join requests|no pending|requests/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test("Overview tab shows event name and guest stat", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();
    const m = new ManageEventPage(page);
    await m.navigate(s.fixedEventId);
    await m.expectEventName("E2E Free Event");
    await m.expectOverviewStat(/guests?|attendees?/i);
  });

  test("Invite button is accessible on guests tab", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();
    const m = new ManageEventPage(page);
    await m.navigate(s.fixedEventId);
    await m.selectTab("guests");
    await m.selectGuestsSubTab("guests");
    const inviteBtn = page.getByRole("button", { name: /invite|add guest/i }).first();
    await expect(inviteBtn).toBeVisible({ timeout: 5_000 });
  });
});
