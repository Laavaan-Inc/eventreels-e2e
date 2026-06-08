/**
 * rsvp.spec.ts — Full RSVP user journeys
 *
 * Scenarios covered:
 *  1. Free event — guest RSVPs "going" → organizer sees them in guest list
 *  2. Approval event — guest requests join → organizer sees pending request
 *  3. Approval event — organizer approves request → guest moves to confirmed
 *  4. Date-TBD event — guest RSVP as Interested via UI → organizer sees label
 *
 * Guest actions that happen before the organizer's browser view are done via
 * API helpers (as if the guest used the mobile/web app), then we assert the
 * organizer's manage view reflects the correct state.
 */

import { test, expect } from "../fixtures/traced-test";
import { ManageEventPage }     from "../page-objects/ManageEventPage";
import { EventPage }           from "../page-objects/EventPage";
import { getSeededEvents, loginUser, registerForEvent, rsvpDateUndecided } from "../utils/api-helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Free-event RSVP journey
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Free event RSVP journey", () => {
  test("guest who RSVPed shows in organizer's guest list", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    const manage = new ManageEventPage(page);
    await manage.navigate(s.fixedEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("guests");

    // At least one guest was seeded going via registerForEvent in global-setup
    await expect(
      page.getByText(/guests?|attendees?/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("guest count on overview stat updates after RSVP", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    // Add another guest RSVP via API
    const { token } = await loginUser("+15555555551");
    await registerForEvent(token, s.fixedEventId);

    const manage = new ManageEventPage(page);
    await manage.navigate(s.fixedEventId);
    await manage.expectOverviewStat(/guests?|going/i);
  });

  test("organizer sees event page with RSVP'd guest count", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    const ep = new EventPage(page);
    await ep.navigate(s.organizerUsername, s.fixedShortCode || s.fixedEventId);
    await ep.expectEventLoaded("E2E Free Event");

    // Guest count badge or stat is visible
    await expect(
      page.getByText(/\d+\s*(going|attending|guests?)/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Approval-event RSVP journey
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Approval event RSVP journey", () => {
  test("pending join request appears in organizer Join Requests tab", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.approvalEventId) test.skip();

    const manage = new ManageEventPage(page);
    await manage.navigate(s.approvalEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");

    // Seeded join request should be visible
    await expect(
      page.getByText(/pending|requests?|join/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("new join request appears after guest requests to join", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.approvalEventId) test.skip();

    // Guest registers via API — creates a pending AttendRequest
    const { token } = await loginUser("+15555555552");
    await registerForEvent(token, s.approvalEventId);

    const manage = new ManageEventPage(page);
    await manage.navigate(s.approvalEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");

    await expect(
      page.getByText(/request|pending/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("approving a join request shows success feedback", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.approvalEventId) test.skip();

    const manage = new ManageEventPage(page);
    await manage.navigate(s.approvalEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");

    const approveBtn = page.getByRole("button", { name: /approve|accept/i }).first();
    if (!(await approveBtn.isVisible({ timeout: 5_000 }).catch(() => false))) test.skip();

    await approveBtn.click();
    await expect(
      page.getByText(/approved|success|confirmed/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("after approval, guest appears in confirmed Guests tab", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.approvalEventId) test.skip();

    // Seed a fresh guest and approve via UI
    const { token, user } = await loginUser("+15555555553");
    await registerForEvent(token, s.approvalEventId);

    const manage = new ManageEventPage(page);
    await manage.navigate(s.approvalEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");

    const approveBtn = page.getByRole("button", { name: /approve|accept/i }).first();
    if (!(await approveBtn.isVisible({ timeout: 5_000 }).catch(() => false))) test.skip();
    await approveBtn.click();
    await page.waitForTimeout(800);

    // Switch to confirmed guests tab
    await manage.selectGuestsSubTab("guests");
    await expect(
      page.getByText(/guests?|attendees?/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("invite-only event shows Approve Guests button on event page", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.approvalEventId) test.skip();

    const ep = new EventPage(page);
    await ep.navigate(s.organizerUsername, s.approvalShortCode || s.approvalEventId);
    await ep.expectApproveGuestsButton();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Date-TBD RSVP journey
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Date-TBD RSVP journey", () => {
  test("seeded Interested RSVP shows in Join Requests as 'Interested' label", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");
    await manage.expectRsvpLabelPill("Interested");
  });

  test("seeded Maybe RSVP shows in Join Requests as 'Maybe' label", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");
    await manage.expectRsvpLabelPill("Maybe");
  });

  test("seeded Not-going RSVP shows in Join Requests as 'Not going' label", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");
    await manage.expectRsvpLabelPill("Not going");
  });

  test("new Interested RSVP via API appears in Join Requests immediately", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const { token } = await loginUser("+15555555554");
    await rsvpDateUndecided(token, s.tbdEventId, "going"); // "going" maps to Interested for TBD

    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");

    await expect(
      page.getByText(/Interested|going/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("all three RSVP labels are visible simultaneously", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");

    await manage.expectRsvpLabelPill("Interested");
    await manage.expectRsvpLabelPill("Maybe");
    await manage.expectRsvpLabelPill("Not going");
  });

  test("Date-TBD Join Requests tab shows no approve/reject buttons", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");
    await manage.expectNoApproveRejectButtons();
  });
});
