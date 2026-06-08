/**
 * check-in.spec.ts — Manual check-in flows
 */

import { test } from "@playwright/test";
import { CheckInPage }    from "../page-objects/CheckInPage";
import { getSeededEvents } from "../utils/api-helpers";

test.describe("Check-in", () => {
  test("check-in page loads for seeded event", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();
    const c = new CheckInPage(page);
    await c.navigate(s.fixedEventId);
    await c.expectCheckedInGuestList();
  });

  test("invalid ticket code shows error", async ({ page }) => {
    const s = getSeededEvents();
    if (!s.fixedEventId) test.skip();
    const c = new CheckInPage(page);
    await c.navigate(s.fixedEventId);
    await c.switchToManualMode();
    await c.enterTicketCode("INVALID-CODE-9999");
    await c.submitCode();
    await c.expectCheckInError();
  });
});
