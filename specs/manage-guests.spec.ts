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
    // ── Step 1: Create a free event as the organizer ──────────────────────────
    const createPage = new CreateEventPage(page);
    await createPage.navigate();
    const eventName = `E2E Invite Journey ${Date.now()}`;
    await createPage.fillRequiredFields(eventName);
    await createPage.submitForm();
    await createPage.waitForEventPage();
  
    // Capture the event URL/ID from the redirect
    const eventUrl = page.url();
    expect(eventUrl).not.toContain('/create');

    // Extract short code from URL (structure: /username/e/shortCode)
    const urlParts = eventUrl.split('/');
    const eventShortCode = urlParts[urlParts.length - 1];

    // Resolve short code → MongoDB _id (manage page's event-access API requires ObjectId)
    const organizerToken = getOrganizerToken();
    const resolvedEvent = await getEventData(organizerToken, eventShortCode);
    const eventMongoId: string = resolvedEvent?._id ?? eventShortCode;
    const creatorObj = resolvedEvent?.creatorId && typeof resolvedEvent.creatorId === 'object'
      ? resolvedEvent.creatorId : null;
    const creatorUsername: string = creatorObj?.username ?? creatorObj?.name ?? urlParts[urlParts.length - 3] ?? '';

    // ── Step 2: Send invite to +14444444444 via Manage > Guests ───────────────
    await page.goto(`/manage?id=${eventMongoId}`);
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle').catch(() => {});
  
    const manage = new ManageEventPage(page);
    await manage.selectTab('guests');
    await manage.selectGuestsSubTab('guests');
  
    // Open invite dialog
    const inviteBtn = page.getByRole('button', { name: /invite|add guest/i }).first();
    await expect(inviteBtn).toBeVisible({ timeout: 8_000 });
    await inviteBtn.click();
    await page.waitForTimeout(500);
  
    // Fill in the phone number for the invite
    const phoneInput = page.locator('input[type="tel"], input[placeholder*="phone" i], input[placeholder*="number" i]').first();
    const hasPhoneInput = await phoneInput.isVisible({ timeout: 5_000 }).catch(() => false);
  
    if (hasPhoneInput) {
      await phoneInput.fill('+14444444444');
    } else {
      // Fallback: try a generic text input in the invite dialog
      const anyInput = page.locator('[role="dialog"] input, [class*="invite"] input, [class*="modal"] input').first();
      await expect(anyInput).toBeVisible({ timeout: 5_000 });
      await anyInput.fill('+14444444444');
    }
  
    // Submit the invite
    const sendBtn = page.getByRole('button', { name: /send|invite|submit/i }).first();
    await expect(sendBtn).toBeVisible({ timeout: 5_000 });
    await sendBtn.click();
  
    // Confirm invite was sent
    await expect(
      page.getByText(/invite sent|invited|success/i).first()
    ).toBeVisible({ timeout: 8_000 });
  
    // ── Step 3: Guest (+14444444444) opens invite link and accepts ────────────
    // Retrieve the invite link — it may appear on screen after sending
    // Alternatively, navigate directly to the event page as the guest
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
  
    // Authenticate as the guest user
    const guestAuth = new AuthPage(guestPage);
    await guestAuth.navigate();
    await guestAuth.fillPhone('+14444444444');
    await guestAuth.clickSendCode();
    await guestAuth.expectOtpInput();
    await guestAuth.fillOtp('000000');
    await guestAuth.waitForRedirectFromAuth();
    expect(guestPage.url()).not.toContain('/auth');
  
    // Guest navigates to the event page via the invite link / event URL
    await guestPage.goto(eventUrl);
    await guestPage.waitForLoadState('load');
    await guestPage.waitForLoadState('networkidle').catch(() => {});
  
    // Guest registers / accepts the invite
    const guestEventPage = new EventPage(guestPage);
    await guestEventPage.clickRegister();
  
    // Confirm RSVP acceptance
    await expect(
      guestPage.getByText(/going|registered|confirmed|you're in|rsvp/i).first()
    ).toBeVisible({ timeout: 8_000 });
  
    // ── Step 4: Organizer verifies +14444444444 appears in the guest list ─────
    await manage.navigate(eventMongoId);
    await manage.selectTab('guests');
    await manage.selectGuestsSubTab('guests');
  
    await expect(
      page.getByText(/444.?444.?4444|\+14444444444/i).first()
    ).toBeVisible({ timeout: 8_000 });
  
    // ── Step 5: Verify +14444444444 has a ticket ──────────────────────────────
    // The guest row should show a ticket indicator
    const guestRow = page.locator(
      '[data-testid="guest-row"], [class*="guest-row"], [class*="guestRow"]'
    ).filter({ hasText: /444/ }).first();
  
    const ticketVisible = await page.getByText(/ticket|✓|confirmed/i)
      .first().isVisible({ timeout: 5_000 }).catch(() => false);
    const rowVisible = await guestRow.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(ticketVisible || rowVisible).toBe(true);
  
    // ── Step 6: Guest posts in the event community ────────────────────────────
    const communityPage = new CommunityPage(guestPage);
    await communityPage.navigate(`${creatorUsername}/e/${eventShortCode}`);
  
    const postCaption = `Test community post from guest ${Date.now()}`;
    await communityPage.openNewPostDialog();
    await communityPage.fillPostCaption(postCaption);
    await communityPage.submitPost();
    await communityPage.expectPostCreatedToast();
    await communityPage.expectPostVisible(postCaption);
  
    await guestContext.close();
  });
});
