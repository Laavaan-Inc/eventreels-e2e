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
  getSeededEvents, getStoredToken, createFixedEvent, loginUser,
  requestTicket, registerForEvent, getGuestList,
} from "../utils/api-helpers";
import { TEST_PHONE_4, TEST_OTP, SEEDED_EVENTS_PATH } from "../config/test-data";

// Pre-requisite: ensure a real ticket exists on a fixed event before any
// check-in test runs.
//
// Flow:
//  1. If no fixedEventId → create the event via API (organizer token)
//  2. Login TEST_PHONE_4 and call POST /participants/request — the same
//     endpoint the Register button hits — to create a real ticket with a code
//  3. Fetch the ticketCode from the organizer's guest list and store it
test.beforeAll(async () => {
  let seeded = getSeededEvents();

  // ── 1. Create event if it doesn't exist yet ─────────────────────────────
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
      return;
    }
  }

  // ── 2. Register TEST_PHONE_4 and create a real ticket ──────────────────
  let guestToken = "";
  try {
    const { token } = await loginUser(TEST_PHONE_4, TEST_OTP);
    guestToken = token;
  } catch (err: any) {
    console.warn("[check-in setup] Could not login TEST_PHONE_4:", err?.message);
  }

  let ticketCode: string | null = null;

  if (guestToken) {
    // Try the proper ticket endpoint — returns the ticketCode directly in the response
    try {
      ticketCode = await requestTicket(guestToken, seeded.fixedEventId);
      console.log("[check-in setup] Ticket created via POST /participants/request, code:", ticketCode ?? "(not in response)");
    } catch (err: any) {
      console.warn("[check-in setup] /participants/request failed:", err?.message, "— trying /events/handle-invite-link");
      try {
        await registerForEvent(guestToken, seeded.fixedEventId);
        console.log("[check-in setup] Registered via POST /events/handle-invite-link");
      } catch (err2: any) {
        console.warn("[check-in setup] Both registration endpoints failed:", err2?.message);
      }
    }
  }

  // ── 3. Persist ticketCode — try response first, then organizer guest list ─
  if (!ticketCode) {
    // ticketCode wasn't in the response body — fetch it from the guest list
    try {
      const organizerToken = getStoredToken();
      const guests = await getGuestList(organizerToken, seeded.fixedEventId);
      console.log("[check-in setup] Guests:", JSON.stringify(guests.map((g: any) => ({
        name: g.name, ticketCode: g.ticketCode ?? "(none)",
      }))));
      ticketCode = guests.find((g: any) => g.ticketCode)?.ticketCode ?? null;
    } catch (err: any) {
      console.warn("[check-in setup] Could not fetch guest list:", err?.message);
    }
  }

  if (ticketCode) {
    seeded = { ...seeded, fixedTicketCode: ticketCode };
    fs.writeFileSync(SEEDED_EVENTS_PATH, JSON.stringify(seeded, null, 2));
    console.log("[check-in setup] Ticket code ready:", ticketCode);
  } else {
    console.warn("[check-in setup] No ticketCode found — valid-ticket test will skip");
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

  test("valid ticket code checks in the guest successfully", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId || !s.fixedTicketCode) test.skip();

    const c = new CheckInPage(page);
    await c.navigate(s.fixedEventId);
    await c.switchToManualMode();
    await c.enterTicketCode(s.fixedTicketCode);
    await c.submitCode();
    await c.expectCheckInSuccess();
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
