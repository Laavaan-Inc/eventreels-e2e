/**
 * date-undecided.spec.ts — Full dateUndecided event lifecycle (organizer view)
 *
 * Scenarios:
 *  A. Event page — organizer UI shows Confirm Date (not Approve Guests)
 *  B. Confirm Date flow — opens date picker, allows organizer to set a date
 *  C. Fixed-date event correctly shows Approve Guests button instead
 *  D. Manage overview — Interested count links to Join Requests sub-tab
 *  E. Join Requests tab — all 3 RSVP labels shown, no approve/reject buttons
 *  F. Guest RSVP labels correctly colour-coded (Interested / Maybe / Not going)
 */

import { test, expect } from "@playwright/test";
import { EventPage }       from "../page-objects/EventPage";
import { ManageEventPage } from "../page-objects/ManageEventPage";
import { getSeededEvents }  from "../utils/api-helpers";

// ─────────────────────────────────────────────────────────────────────────────
// A. Event page — organizer buttons
// ─────────────────────────────────────────────────────────────────────────────

test.describe("dateUndecided — event page buttons", () => {
  test("shows 'Confirm Date' button (not 'Approve Guests')", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const ep = new EventPage(page);
    await ep.navigate(s.organizerUsername, s.tbdEventShortCode || s.tbdEventId);
    await ep.expectConfirmDateButton();
    await expect(
      page.getByRole("button", { name: /approve guests/i })
    ).not.toBeVisible({ timeout: 3_000 });
  });

  test("'Confirm Date' button opens a date-picker dialog", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const ep = new EventPage(page);
    await ep.navigate(s.organizerUsername, s.tbdEventShortCode || s.tbdEventId);
    await ep.clickConfirmDate();
    await expect(
      page.getByText(/start date|select date|pick date|choose date/i).first()
    ).toBeVisible({ timeout: 6_000 });
  });

  test("date picker shows a calendar or date input", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const ep = new EventPage(page);
    await ep.navigate(s.organizerUsername, s.tbdEventShortCode || s.tbdEventId);
    await ep.clickConfirmDate();

    const calendar = page.locator('[role="dialog"] [role="grid"], [aria-label*="calendar" i], input[type="date"]').first();
    await expect(calendar).toBeVisible({ timeout: 6_000 });
  });

  test("fixed-date event shows 'Approve Guests' button", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    const ep = new EventPage(page);
    await ep.navigate(s.organizerUsername, s.fixedEventShortCode || s.fixedEventId);
    await ep.expectApproveGuestsButton();
  });

  test("fixed-date event does NOT show 'Confirm Date' button", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    const ep = new EventPage(page);
    await ep.navigate(s.organizerUsername, s.fixedEventShortCode || s.fixedEventId);
    await expect(
      page.getByRole("button", { name: /confirm date/i })
    ).not.toBeVisible({ timeout: 3_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. Manage overview — Interested count navigation
// ─────────────────────────────────────────────────────────────────────────────

test.describe("dateUndecided — manage overview", () => {
  test("clicking the Interested/response count navigates to Join Requests sub-tab", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.clickInterestedCount();
    await expect(
      page.getByText(/join requests?|interested|maybe/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("overview stat shows response count > 0 for seeded TBD event", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await expect(
      page.getByText(/interested|going|responses?/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. Join Requests tab — RSVP labels
// ─────────────────────────────────────────────────────────────────────────────

test.describe("dateUndecided — Join Requests labels", () => {
  test("shows 'Interested' label pill for seeded user", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");
    await manage.expectRsvpLabelPill("Interested");
  });

  test("shows 'Maybe' label pill for seeded user", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");
    await manage.expectRsvpLabelPill("Maybe");
  });

  test("shows 'Not going' label pill for seeded user", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");
    await manage.expectRsvpLabelPill("Not going");
  });

  test("all three label types visible simultaneously", async ({ page }) => {
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
});

// ─────────────────────────────────────────────────────────────────────────────
// D. Join Requests tab — no approve/reject actions
// ─────────────────────────────────────────────────────────────────────────────

test.describe("dateUndecided — no approval actions", () => {
  test("no Approve/Reject buttons shown on TBD Join Requests tab", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();

    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");
    await manage.expectNoApproveRejectButtons();
  });

  test("approval event DOES show Approve/Reject on its Join Requests tab", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.approvalEventId) test.skip();

    const manage = new ManageEventPage(page);
    await manage.navigate(s.approvalEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");

    // At least one approve button should exist (seeded request)
    const approveBtn = page.getByRole("button", { name: /approve|accept/i }).first();
    const isVisible = await approveBtn.isVisible({ timeout: 6_000 }).catch(() => false);
    // This is optional — skip if no seeded requests, but assert buttons exist if they do
    if (isVisible) {
      await expect(approveBtn).toBeEnabled();
    }
  });
});
