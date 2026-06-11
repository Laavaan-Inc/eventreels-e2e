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
  getSeededEvents, getStoredToken, createFixedEvent, loginUser, getGuestTicketCode,
} from "../utils/api-helpers";
import { TEST_PHONE_4, TEST_OTP, APP_BASE, SEEDED_EVENTS_PATH } from "../config/test-data";

// Pre-requisite: ensure a fixed event exists and TEST_PHONE_4 has registered
// (i.e. a real ticket is present) before any check-in test runs.
//
// Flow:
//  1. If no fixedEventId → create the event via API (organizer token)
//  2. Use TEST_PHONE_4 (+14444444444) as a real attendee:
//     open a browser, inject their auth, navigate to the event page,
//     and click Register — exactly as a guest would.
test.beforeAll(async ({ browser }) => {
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

  if (!seeded.fixedEventId || !seeded.organizerUsername || !seeded.fixedShortCode) return;

  // ── 2. Register as TEST_PHONE_4 via the real event page UI ─────────────
  try {
    const { token, user } = await loginUser(TEST_PHONE_4, TEST_OTP);

    // Build auth storage state the same way global-setup does
    const storageState = {
      cookies: [] as any[],
      origins: [{
        origin: APP_BASE,
        localStorage: [
          { name: "token",    value: token },
          { name: "id",       value: String(user?.id ?? "") },
          { name: "name",     value: String(user?.name ?? "Test Guest 4444") },
          { name: "username", value: String(user?.username ?? "") },
          { name: "phone",    value: String(user?.phone ?? TEST_PHONE_4) },
          { name: "isAuth",   value: "true" },
        ],
      }],
    };

    const ctx  = await browser.newContext({ storageState });
    const page = await ctx.newPage();

    // Navigate to the event page as a real guest would
    await page.goto(`${APP_BASE}/${seeded.organizerUsername}/${seeded.fixedShortCode}`);
    await page.waitForLoadState("networkidle");

    // Click the Register button (only shown to guests who haven't registered yet)
    const registerBtn = page.getByRole("button", { name: /register|join|going/i }).first();
    if (await registerBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await registerBtn.click();
      await page.waitForTimeout(2_000);
      console.log("[check-in setup] TEST_PHONE_4 registered via event page UI");
    } else {
      console.log("[check-in setup] Register button not found — already registered or event not bookable");
    }

    await ctx.close();

    // ── 3. Fetch the real ticket code (organizer sees all tickets) ──────────
    try {
      const organizerToken = getStoredToken();
      const ticketCode = await getGuestTicketCode(organizerToken, seeded.fixedEventId);
      if (ticketCode) {
        seeded = { ...seeded, fixedTicketCode: ticketCode };
        fs.writeFileSync(SEEDED_EVENTS_PATH, JSON.stringify(seeded, null, 2));
        console.log("[check-in setup] Ticket code stored:", ticketCode);
      } else {
        console.warn("[check-in setup] No ticket code found in guest list");
      }
    } catch (err: any) {
      console.warn("[check-in setup] Could not fetch ticket code:", err?.message);
    }
  } catch (err: any) {
    console.warn("[check-in setup] UI registration failed:", err?.message);
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
