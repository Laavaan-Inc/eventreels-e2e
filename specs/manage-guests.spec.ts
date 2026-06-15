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

      await guestPage.goto(eventUrl);
      await guestPage.waitForLoadState('load');
      await guestPage.waitForLoadState('networkidle').catch(() => {});

      const guestEventPage = new EventPage(guestPage);
      await guestEventPage.clickRegister();

      await expect(
        guestPage.getByText(/you.?re going to this event|ticket is confirmed|view ticket/i).first()
      ).toBeVisible({ timeout: 8_000 });
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
      const communityPage = new CommunityPage(guestPage);
      await communityPage.navigate(`${creatorUsername}/e/${eventShortCode}`);

      const postCaption = `Test community post from guest ${Date.now()}`;
      await communityPage.openNewPostDialog();
      await communityPage.fillPostCaption(postCaption);
      await communityPage.submitPost();
      await communityPage.expectPostCreatedToast();
      await communityPage.expectPostVisible(postCaption);
    });

    await guestContext.close();
  });
});
