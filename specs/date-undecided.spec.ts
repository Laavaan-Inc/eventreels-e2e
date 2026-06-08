/**
 * date-undecided.spec.ts — dateUndecided event flows (organizer view)
 *
 * Relies on seeded fixtures from global-setup:
 *  - tbdEventId: a dateUndecided event owned by the organizer
 *  - Secondary users have already RSVPed (Interested, Maybe, Not going)
 */

import { test, expect } from "@playwright/test";
import { EventPage }     from "../page-objects/EventPage";
import { ManageEventPage } from "../page-objects/ManageEventPage";
import { getSeededEvents }  from "../utils/api-helpers";

test.describe("dateUndecided — event page", () => {
  test("Confirm Date button is visible (not Approve Guests)", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();
    const ep = new EventPage(page);
    await ep.navigate(s.organizerUsername, s.tbdEventShortCode || s.tbdEventId);
    await ep.expectConfirmDateButton();
    await expect(page.getByRole("button", { name: /approve guests/i })).not.toBeVisible({ timeout: 3_000 });
  });

  test("Confirm Date button opens date picker dialog", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();
    const ep = new EventPage(page);
    await ep.navigate(s.organizerUsername, s.tbdEventShortCode || s.tbdEventId);
    await ep.clickConfirmDate();
    await expect(page.getByText(/start date|select date|pick date/i).first()).toBeVisible({ timeout: 6_000 });
  });

  test("fixed-date event shows Approve Guests button", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();
    const ep = new EventPage(page);
    await ep.navigate(s.organizerUsername, s.fixedEventShortCode || s.fixedEventId);
    await ep.expectApproveGuestsButton();
  });
});

test.describe("dateUndecided — manage overview", () => {
  test("clicking Interested count navigates to Join Requests sub-tab", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();
    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.clickInterestedCount();
    await expect(page.getByText(/join requests|interested|maybe/i).first()).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("dateUndecided — Join Requests tab", () => {
  test("shows Interested label pill", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();
    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");
    await manage.expectRsvpLabelPill("Interested");
  });

  test("shows Maybe label pill", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();
    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");
    await manage.expectRsvpLabelPill("Maybe");
  });

  test("shows Not going label pill", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();
    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");
    await manage.expectRsvpLabelPill("Not going");
  });

  test("no approve/reject buttons shown", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.tbdEventId) test.skip();
    const manage = new ManageEventPage(page);
    await manage.navigate(s.tbdEventId);
    await manage.selectTab("guests");
    await manage.selectGuestsSubTab("requests");
    await manage.expectNoApproveRejectButtons();
  });
});
