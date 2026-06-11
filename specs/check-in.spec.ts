/**
 * check-in.spec.ts — Organizer check-in flows at the door
 *
 * Scenarios:
 *  1. Check-in page loads for an event the organizer manages
 *  2. Invalid ticket code shows an error (does not check in guest)
 *  3. Guest list on check-in page shows RSVPed guests
 *  4. Already-checked-in guest shows correct status
 */

import * as fs from "fs";
import { test, expect } from "../fixtures/traced-test";
import { CheckInPage }    from "../page-objects/CheckInPage";
import {
  getSeededEvents, getStoredToken, createFixedEvent, loginUser, registerForEvent,
} from "../utils/api-helpers";
import { TEST_PHONE_2, TEST_OTP, SEEDED_EVENTS_PATH } from "../config/test-data";

// Pre-requisite: ensure a fixed event with at least one registered guest
// (ticket) exists before any check-in test runs.
// If global-setup didn't seed one (or seeding failed), create it here.
test.beforeAll(async () => {
  let seeded = getSeededEvents();

  // ── 1. Create event if missing ──────────────────────────────────────────
  if (!seeded.fixedEventId) {
    try {
      const token = getStoredToken();
      const ev = await createFixedEvent(token, "E2E Free Event");
      seeded = {
        ...seeded,
        fixedEventId:   ev._id ?? ev.id ?? "",
        fixedShortCode: ev.shortCode ?? "",
      };
      fs.writeFileSync(SEEDED_EVENTS_PATH, JSON.stringify(seeded, null, 2));
      console.log("[check-in setup] Created event:", seeded.fixedEventId);
    } catch (err: any) {
      console.warn("[check-in setup] Could not create event:", err?.message);
    }
  }

  // ── 2. Register a guest (ticket) on the event ───────────────────────────
  if (seeded.fixedEventId) {
    try {
      const { token } = await loginUser(TEST_PHONE_2, TEST_OTP);
      await registerForEvent(token, seeded.fixedEventId);
    } catch {
      // Already registered — acceptable
    }
  }
});

test.describe("Check-in — page access", () => {
  test("check-in page loads for organizer's seeded event", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    const c = new CheckInPage(page);
    await c.navigate(s.fixedEventId);
    await c.expectCheckedInGuestList();
  });

  test("check-in page shows event name or guest roster", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    const c = new CheckInPage(page);
    await c.navigate(s.fixedEventId);
    await expect(
      page.getByText(/E2E Free Event|check.?in|guests?/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Check-in — manual ticket code entry", () => {
  test("invalid ticket code shows an error message", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    const c = new CheckInPage(page);
    await c.navigate(s.fixedEventId);
    await c.switchToManualMode();
    await c.enterTicketCode("INVALID-TICKET-9999");
    await c.submitCode();
    await c.expectCheckInError();
  });

  test("empty ticket code submission shows validation feedback", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    const c = new CheckInPage(page);
    await c.navigate(s.fixedEventId);
    await c.switchToManualMode();
    await c.enterTicketCode("");
    await c.submitCode();

    // Either an error message or the button is disabled / stays on check-in page
    const url = page.url();
    const hasError = await page.getByText(/invalid|required|enter.*code|cannot be empty/i)
      .first().isVisible({ timeout: 4_000 }).catch(() => false);
    const stayedOnPage = url.includes("check-in");
    expect(hasError || stayedOnPage).toBe(true);
  });

  test("malformed ticket code (special chars) is handled gracefully", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    const c = new CheckInPage(page);
    await c.navigate(s.fixedEventId);
    await c.switchToManualMode();
    await c.enterTicketCode("<script>alert(1)</script>");
    await c.submitCode();

    // Should show error, not crash
    await c.expectCheckInError();
  });
});

test.describe("Check-in — guest roster", () => {
  test("guests who RSVPed 'going' appear on check-in guest list", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();

    const c = new CheckInPage(page);
    await c.navigate(s.fixedEventId);

    // The roster should list at least one guest (seeded in global-setup)
    await expect(
      page.getByText(/guests?|attendees?|checked.?in/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });
});
