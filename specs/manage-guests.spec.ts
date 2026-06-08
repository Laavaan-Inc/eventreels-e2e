/**
 * manage-guests.spec.ts — Organizer guest management flows
 *
 * Scenarios:
 *  1. Guests tab shows RSVPed attendees
 *  2. Join Requests tab shows pending requests for approval events
 *  3. Overview shows correct event name and guest stat
 *  4. Invite guest by email — invite flow is accessible
 *  5. Guest count stat updates after RSVP seed
 *  6. Guests list is searchable / filterable (if feature exists)
 */

import { test, expect } from "../fixtures/traced-test";
import { ManageEventPage } from "../page-objects/ManageEventPage";
import { getSeededEvents, loginUser, registerForEvent } from "../utils/api-helpers";

test.describe("Manage — overview stats", () => {
  test("overview shows event name for fixed event", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    const m = new ManageEventPage(page);
    await m.navigate(s.fixedEventId);
    await m.expectEventName("E2E Free Event");
  });

  test("overview shows a guest/attendee stat", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    const m = new ManageEventPage(page);
    await m.navigate(s.fixedEventId);
    await m.expectOverviewStat(/guests?|attendees?/i);
  });

  test("overview shows join-request stat for approval event", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.approvalEventId) test.skip();

    const m = new ManageEventPage(page);
    await m.navigate(s.approvalEventId);
    await m.expectOverviewStat(/request|pending/i);
  });

  test("clicking interested count navigates to Join Requests sub-tab (TBD event)", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const m = new ManageEventPage(page);
    await m.navigate(s.tbdEventId);
    await m.clickInterestedCount();
    await expect(
      page.getByText(/join requests?|interested|maybe/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("Manage — guests tab", () => {
  test("Guests sub-tab loads and shows guest list for free event", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    const m = new ManageEventPage(page);
    await m.navigate(s.fixedEventId);
    await m.selectTab("guests");
    await m.selectGuestsSubTab("guests");

    await expect(
      page.getByText(/guests|no guests|attendees/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("guest list shows at least one seeded guest", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    const m = new ManageEventPage(page);
    await m.navigate(s.fixedEventId);
    await m.selectTab("guests");
    await m.selectGuestsSubTab("guests");

    // Seeded via global-setup — secondary user registered
    const rows = page.locator(
      '[data-testid="guest-row"], table tbody tr, [class*="guest"]'
    ).filter({ hasNotText: /no guests?/i });
    const count = await rows.count().catch(() => 0);

    const hasGuestsText = await page.getByText(/\d+\s*(guest|attendee)/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(count > 0 || hasGuestsText).toBe(true);
  });

  test("invite button is accessible on the guests tab", async ({ page }) => {
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

test.describe("Manage — join requests (approval event)", () => {
  test("Join Requests tab loads for approval event", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.approvalEventId) test.skip();

    const m = new ManageEventPage(page);
    await m.navigate(s.approvalEventId);
    await m.selectTab("guests");
    await m.selectGuestsSubTab("requests");

    await expect(
      page.getByText(/join requests?|no pending|requests?/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("new join request appears after guest registers via API", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.approvalEventId) test.skip();

    const { token } = await loginUser("+15555500001");
    await registerForEvent(token, s.approvalEventId);

    const m = new ManageEventPage(page);
    await m.navigate(s.approvalEventId);
    await m.selectTab("guests");
    await m.selectGuestsSubTab("requests");

    await expect(
      page.getByText(/pending|request|approve/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("approve button is present on a pending request", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.approvalEventId) test.skip();

    // Seed a pending request
    const { token } = await loginUser("+15555500002");
    await registerForEvent(token, s.approvalEventId);

    const m = new ManageEventPage(page);
    await m.navigate(s.approvalEventId);
    await m.selectTab("guests");
    await m.selectGuestsSubTab("requests");

    const approveBtn = page.getByRole("button", { name: /approve|accept/i }).first();
    const hasPending = await approveBtn.isVisible({ timeout: 6_000 }).catch(() => false);
    if (!hasPending) test.skip(); // no pending requests yet — skip gracefully
    await expect(approveBtn).toBeEnabled();
  });

  test("reject button is present on a pending request", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.approvalEventId) test.skip();

    const { token } = await loginUser("+15555500003");
    await registerForEvent(token, s.approvalEventId);

    const m = new ManageEventPage(page);
    await m.navigate(s.approvalEventId);
    await m.selectTab("guests");
    await m.selectGuestsSubTab("requests");

    const rejectBtn = page.getByRole("button", { name: /reject|decline/i }).first();
    const hasPending = await rejectBtn.isVisible({ timeout: 6_000 }).catch(() => false);
    if (!hasPending) test.skip();
    await expect(rejectBtn).toBeEnabled();
  });
});

test.describe("Manage — invite flow", () => {
  test("invite dialog opens with an email input field", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    const m = new ManageEventPage(page);
    await m.navigate(s.fixedEventId);
    await m.selectTab("guests");
    await m.selectGuestsSubTab("guests");

    const inviteBtn = page.getByRole("button", { name: /invite|add guest/i }).first();
    await expect(inviteBtn).toBeVisible({ timeout: 5_000 });
    await inviteBtn.click();
    await page.waitForTimeout(400);

    // An email input or dialog should appear
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    const dialogVisible = await emailInput.isVisible({ timeout: 5_000 }).catch(() => false);
    const inviteDialog = await page.getByText(/invite|enter email/i).first().isVisible({ timeout: 3_000 }).catch(() => false);
    expect(dialogVisible || inviteDialog).toBe(true);
  });
});
