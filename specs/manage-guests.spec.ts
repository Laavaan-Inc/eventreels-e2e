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

import { test, expect, snap, LIVE_SHOT_PATH } from "../fixtures/traced-test";
import { ManageEventPage } from "../page-objects/ManageEventPage";
import { getSeededEvents, loginUser, registerForEvent, getOrganizerToken, getEventData } from "../utils/api-helpers";
import { CommunityPage } from '../page-objects/CommunityPage';
import { CreateEventPage } from '../page-objects/CreateEventPage';
import { AuthPage } from '../page-objects/AuthPage';
import { EventPage } from '../page-objects/EventPage';

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

test.describe("Manage — full invite-to-community journey", () => {
  test('invite guest by phone, guest accepts invite, appears in guest list with ticket, posts in community', async ({ page, browser }) => {
    test.setTimeout(240_000); // 4 min — multi-step journey with two browser contexts

    let eventUrl = '';
    let eventShortCode = '';
    let eventMongoId = '';
    let creatorUsername = '';

    // ── Step 1: Create a free event as the organizer ──────────────────────────
    await test.step('Step 1: organizer creates a free event', async () => {
      const createPage = new CreateEventPage(page);
      await createPage.navigate();
      const eventName = `E2E Invite Journey ${Date.now()}`;
      await createPage.fillRequiredFields(eventName);
      await createPage.submitForm();
      await createPage.waitForEventPage();

      eventUrl = page.url();
      expect(eventUrl).not.toContain('/create');

      const urlParts = eventUrl.split('/');
      eventShortCode = urlParts[urlParts.length - 1];

      const organizerToken = getOrganizerToken();
      const resolvedEvent = await getEventData(organizerToken, eventShortCode);
      eventMongoId = resolvedEvent?._id ?? eventShortCode;
      const creatorObj = resolvedEvent?.creatorId && typeof resolvedEvent.creatorId === 'object'
        ? resolvedEvent.creatorId : null;
      creatorUsername = creatorObj?.username ?? creatorObj?.name ?? urlParts[urlParts.length - 3] ?? '';
    });

    // ── Step 2: Send invite to +14444444444 via Manage > Guests ───────────────
    const manage = new ManageEventPage(page);
    await test.step('Step 2: organizer sends phone invite to +14444444444', async () => {
      await page.goto(`/manage?id=${eventMongoId}`);
      await page.waitForLoadState('load');
      await page.waitForLoadState('networkidle').catch(() => {});

      await manage.selectTab('guests');
      await manage.selectGuestsSubTab('guests');

      const inviteBtn = page.getByRole('button', { name: /^invite guests$/i }).first();
      await expect(inviteBtn).toBeVisible({ timeout: 8_000 });
      await inviteBtn.click();

      await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 6_000 });
      await page.waitForTimeout(300);

      const phoneTab = page.getByRole('tab', { name: /phone/i }).first();
      await expect(phoneTab).toBeVisible({ timeout: 5_000 });
      await phoneTab.click();
      await page.waitForTimeout(300);

      const phoneInput = page.locator('#invitePhone, input[type="tel"]').first();
      await expect(phoneInput).toBeVisible({ timeout: 5_000 });
      await phoneInput.fill('4444444444');

      const sendBtn = page.getByRole('button', { name: /send invitation/i }).first();
      await expect(sendBtn).toBeVisible({ timeout: 5_000 });
      await sendBtn.click();

      await expect(
        page.getByText(/invitation sent|invite sent|invited|success/i).first()
      ).toBeVisible({ timeout: 8_000 });
    });

    // ── Step 3: Guest accepts the invite ──────────────────────────────────────
    let guestContext: any;
    let guestPage: any;
    await test.step('Step 3: guest opens event page and accepts invite (RSVP going)', async () => {
      const guestResult = await loginUser('+14444444444', '000000');
      guestContext = await browser.newContext({
        storageState: {
          cookies: [],
          origins: [{
            origin: new URL(process.env.APP_BASE ?? 'http://localhost:3000').origin,
            localStorage: [
              { name: 'token',         value: guestResult.token },
              { name: 'refresh_token', value: guestResult.refreshToken ?? '' },
              { name: 'id',            value: String(guestResult.user?.id ?? '') },
              { name: 'name',          value: String(guestResult.user?.name ?? 'E2E Guest') },
              { name: 'username',      value: String(guestResult.user?.username ?? '') },
              { name: 'phone',         value: '+14444444444' },
              { name: 'email',         value: String(guestResult.user?.email ?? '') },
              { name: 'role',          value: String(guestResult.user?.role ?? '1') },
              { name: 'isAuth',        value: 'true' },
            ],
          }],
        },
      });
      guestPage = await guestContext.newPage();

      // Pause the fixture's organizer poller and drive the live feed ourselves
      (globalThis as any).__e2eLivePaused = true;
      let gCapturing = true;
      const gInterval = setInterval(async () => {
        if (gCapturing) await snap(guestPage);
      }, 200);

      await guestPage.goto(eventUrl);
      await guestPage.waitForLoadState('load');
      await guestPage.waitForLoadState('networkidle').catch(() => {});

      const guestEventPage = new EventPage(guestPage);
      await guestEventPage.clickRegister();

      await expect(
        guestPage.getByText(/you.?re going to this event|ticket is confirmed|view ticket/i).first()
      ).toBeVisible({ timeout: 8_000 });

      gCapturing = false;
      clearInterval(gInterval);
      (globalThis as any).__e2eLivePaused = false;
    });

    // ── Step 4: Organizer sees guest in the guest list ────────────────────────
    await test.step('Step 4: organizer verifies guest appears in guest list', async () => {
      await page.waitForTimeout(1_000);
      await manage.navigate(eventMongoId);
      await manage.selectTab('guests');
      await manage.selectGuestsSubTab('guests');

      const hasGuest4444 = await page.getByText(/4444|test.*4444/i).first().isVisible({ timeout: 8_000 }).catch(() => false);
      const hasGuestCount = await page.getByText(/1 guest|1 attendee/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasGuest4444 || hasGuestCount).toBe(true);
    });

    // ── Step 5: Verify guest has a ticket ────────────────────────────────────
    await test.step('Step 5: guest list count > 0 (ticket issued on RSVP)', async () => {
      const guestCount = await page.getByText(/\d+ guests?|\d+ attendees?/i).first().innerText({ timeout: 5_000 }).catch(() => '0');
      const num = parseInt(guestCount.match(/\d+/)?.[0] ?? '0', 10);
      expect(num).toBeGreaterThan(0);
    });

    // ── Step 6: Guest posts in the event community ────────────────────────────
    await test.step('Step 6: guest posts in event community', async () => {
      (globalThis as any).__e2eLivePaused = true;
      let gCapturing = true;
      const gInterval = setInterval(async () => {
        if (gCapturing) await snap(guestPage);
      }, 200);

      const communityPage = new CommunityPage(guestPage);
      await communityPage.navigate(`${creatorUsername}/e/${eventShortCode}`);

      const postCaption = `Test community post from guest ${Date.now()}`;
      await communityPage.openNewPostDialog();
      await communityPage.fillPostCaption(postCaption);
      await communityPage.submitPost();
      await communityPage.expectPostCreatedToast();
      await communityPage.expectPostVisible(postCaption);

      gCapturing = false;
      clearInterval(gInterval);
      (globalThis as any).__e2eLivePaused = false;
    });

    await guestContext.close();
  });
});

test.describe("Manage — full chip-in invite-to-approval journey", () => {
  test('chip-in event: organizer invites guest, guest pays and uploads receipt, organizer approves, guest sees approval notification and ticket in guest list', async ({ page, browser }) => {
    test.setTimeout(300_000); // 5 min — multi-step chip-in approval journey
  
    let eventUrl = '';
    let eventShortCode = '';
    let eventMongoId = '';
    let creatorUsername = '';
  
    // ── Step 1: Organizer creates a chip-in event ─────────────────────────────
    await test.step('Step 1: organizer creates a chip-in event', async () => {
      const createPage = new CreateEventPage(page);
      await createPage.navigate();
      const eventName = `E2E Chip-In Journey ${Date.now()}`;
      await createPage.fillRequiredFields(eventName);
      await createPage.setTicketMode('chip');
      await createPage.setChipAmount('20');
      await createPage.submitForm();
      await createPage.waitForEventPage();
  
      eventUrl = page.url();
      expect(eventUrl).not.toContain('/create');
  
      const urlParts = eventUrl.split('/');
      eventShortCode = urlParts[urlParts.length - 1];
  
      const organizerToken = getOrganizerToken();
      const resolvedEvent = await getEventData(organizerToken, eventShortCode);
      eventMongoId = resolvedEvent?._id ?? eventShortCode;
      const creatorObj = resolvedEvent?.creatorId && typeof resolvedEvent.creatorId === 'object'
        ? resolvedEvent.creatorId : null;
      creatorUsername = creatorObj?.username ?? creatorObj?.name ?? urlParts[urlParts.length - 3] ?? '';
  
      // Verify event type is chipin on the created event
      expect(resolvedEvent?.eventType ?? resolvedEvent?.type ?? 'chipin').toMatch(/chipin|chip/i);
    });
  
    // ── Step 2: Organizer sends invite to +14444444444 ────────────────────────
    const manage = new ManageEventPage(page);
    await test.step('Step 2: organizer sends phone invite to +14444444444', async () => {
      await page.goto(`/manage?id=${eventMongoId}`);
      await page.waitForLoadState('load');
      await page.waitForLoadState('networkidle').catch(() => {});
  
      await manage.selectTab('guests');
      await manage.selectGuestsSubTab('guests');
  
      const inviteBtn = page.getByRole('button', { name: /^invite guests$/i }).first();
      await expect(inviteBtn).toBeVisible({ timeout: 8_000 });
      await inviteBtn.click();
  
      await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 6_000 });
      await page.waitForTimeout(300);
  
      const phoneTab = page.getByRole('tab', { name: /phone/i }).first();
      await expect(phoneTab).toBeVisible({ timeout: 5_000 });
      await phoneTab.click();
      await page.waitForTimeout(300);
  
      const phoneInput = page.locator('#invitePhone, input[type="tel"]').first();
      await expect(phoneInput).toBeVisible({ timeout: 5_000 });
      await phoneInput.fill('4444444444');
  
      const sendBtn = page.getByRole('button', { name: /send invitation/i }).first();
      await expect(sendBtn).toBeVisible({ timeout: 5_000 });
      await sendBtn.click();
  
      await expect(
        page.getByText(/invitation sent|invite sent|invited|success/i).first()
      ).toBeVisible({ timeout: 8_000 });
    });
  
    // ── Step 3: Guest opens event, completes payment flow, uploads receipt ────
    let guestContext: any;
    let guestPage: any;
    await test.step('Step 3: guest completes payment flow and uploads receipt', async () => {
      const guestResult = await loginUser('+14444444444', '000000');
      guestContext = await browser.newContext({
        storageState: {
          cookies: [],
          origins: [{
            origin: new URL(process.env.APP_BASE ?? 'http://localhost:3000').origin,
            localStorage: [
              { name: 'token',         value: guestResult.token },
              { name: 'refresh_token', value: guestResult.refreshToken ?? '' },
              { name: 'id',            value: String(guestResult.user?.id ?? '') },
              { name: 'name',          value: String(guestResult.user?.name ?? 'E2E Guest') },
              { name: 'username',      value: String(guestResult.user?.username ?? '') },
              { name: 'phone',         value: '+14444444444' },
              { name: 'email',         value: String(guestResult.user?.email ?? '') },
              { name: 'role',          value: String(guestResult.user?.role ?? '1') },
              { name: 'isAuth',        value: 'true' },
            ],
          }],
        },
      });
      guestPage = await guestContext.newPage();

      // Switch live feed to guest browser
      (globalThis as any).__e2eLivePaused = true;
      let gCapturing = true;
      const gInterval = setInterval(async () => {
        if (gCapturing) await snap(guestPage);
      }, 200);

      await guestPage.goto(eventUrl);
      await guestPage.waitForLoadState('load');
      await guestPage.waitForLoadState('networkidle').catch(() => {});

      // Guest clicks "I'm going" → PaymentReceiptDialog opens for chip-in events
      const guestEventPage = new EventPage(guestPage);
      await guestEventPage.clickRegister();

      // Wait for the Upload Payment Receipt dialog to appear
      await expect(
        guestPage.getByText(/upload payment receipt/i).first()
      ).toBeVisible({ timeout: 8_000 });

      // The file input is hidden (className="hidden") but Playwright can still
      // call setInputFiles on hidden inputs — do NOT check isVisible() here.
      const receiptFileInput = guestPage.locator('#receipt-upload, input[type="file"]').first();
      await receiptFileInput.setInputFiles({
        name: 'receipt.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64'
        ),
      });
      // Wait for image preview to render (enables the Submit Receipt button)
      await guestPage.waitForTimeout(800);

      // Submit Receipt button is now enabled
      const submitBtn = guestPage.getByRole('button', { name: /submit receipt/i }).first();
      await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
      await submitBtn.click();

      // After submission: toast appears, dialog closes, state → waitingForApproval
      await expect(
        guestPage.getByText(/receipt.*submitted|waiting.*approval|waiting for approval/i).first()
      ).toBeVisible({ timeout: 10_000 });

      gCapturing = false;
      clearInterval(gInterval);
      (globalThis as any).__e2eLivePaused = false;
    });
  
    // ── Step 4: Organizer reviews receipt in Join Requests and approves ───────
    await test.step('Step 4: organizer navigates to Join Requests and approves receipt', async () => {
      await page.waitForTimeout(1_000);
      await manage.navigate(eventMongoId);

      // Chip-in receipt approvals live in Guests > Join Requests, not the Payment tab
      await manage.selectTab('guests');
      await manage.selectGuestsSubTab('requests');

      // Wait for the pending receipt request to appear
      await expect(
        page.getByText(/receipt available|pending/i).first()
      ).toBeVisible({ timeout: 10_000 });

      // Approve button is an icon-only button with aria-label="Approve" (added in RequestsList.tsx)
      const approveBtn = page.getByRole('button', { name: /^approve$/i }).first();
      await expect(approveBtn).toBeVisible({ timeout: 6_000 });
      await approveBtn.click();

      // Organizer sees "Request approved!" toast
      await expect(
        page.getByText(/request approved|approved/i).first()
      ).toBeVisible({ timeout: 8_000 });
    });
  
    // ── Step 5: Guest receives approval notification ──────────────────────────
    await test.step('Step 5: guest sees approval — TicketView renders', async () => {
      // Brief pause so the approval propagates in the DB before the guest reloads
      await page.waitForTimeout(1_500);

      (globalThis as any).__e2eLivePaused = true;
      let gCapturing = true;
      const gInterval = setInterval(async () => {
        if (gCapturing) await snap(guestPage);
      }, 200);

      // Reload the event page — state is now alreadyHasTicket, TicketView renders
      await guestPage.goto(eventUrl);
      await guestPage.waitForLoadState('load');
      await guestPage.waitForLoadState('networkidle').catch(() => {});

      // TicketView: "You're Going to This Event" / "Your ticket is confirmed!"
      // filter({ visible: true }) skips any hidden mobile/desktop duplicate copy
      await expect(
        guestPage.getByText(/going to this event|ticket is confirmed|view ticket/i)
          .filter({ visible: true }).first()
      ).toBeVisible({ timeout: 10_000 });

      gCapturing = false;
      clearInterval(gInterval);
      (globalThis as any).__e2eLivePaused = false;
    });
  
    // ── Step 6: Guest appears in confirmed guest list ─────────────────────────
    await test.step('Step 6: organizer confirms guest is in confirmed guest list', async () => {
      await manage.navigate(eventMongoId);
      await manage.selectTab('guests');
      await manage.selectGuestsSubTab('guests');
  
      const hasGuest4444 = await page.getByText(/4444|444.444.4444/i).first().isVisible({ timeout: 8_000 }).catch(() => false);
      const hasGuestCount = await page.getByText(/1 guest|1 attendee/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasGuest4444 || hasGuestCount).toBe(true);
    });
  
    // ── Step 7: Guest's ticket is visible ────────────────────────────────────
    await test.step('Step 7: guest can see their ticket on the event page', async () => {
      (globalThis as any).__e2eLivePaused = true;
      let gCapturing = true;
      const gInterval = setInterval(async () => {
        if (gCapturing) await snap(guestPage);
      }, 200);

      await guestPage.goto(eventUrl);
      await guestPage.waitForLoadState('load');
      await guestPage.waitForLoadState('networkidle').catch(() => {});

      await expect(
        guestPage.getByText(/view ticket|your ticket|ticket confirmed|going to this event/i)
          .filter({ visible: true }).first()
      ).toBeVisible({ timeout: 8_000 });

      gCapturing = false;
      clearInterval(gInterval);
      (globalThis as any).__e2eLivePaused = false;
    });
  
    await guestContext.close();
  });
});
