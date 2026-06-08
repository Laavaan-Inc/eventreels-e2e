import { Page, expect } from "@playwright/test";

type GuestsSubTab = "guests" | "requests" | "invited" | "track-rsvp";

export class ManageEventPage {
  constructor(private page: Page) {}

  async navigate(eventId: string) {
    await this.page.goto(`/manage?id=${eventId}`);
    await this.page.waitForLoadState("networkidle");
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  async selectTab(tab: "overview" | "guests" | "community" | "managers" | "analytics" | "payment" | "more") {
    const tabMap: Record<string, RegExp> = {
      overview:  /overview/i,
      guests:    /guests/i,
      community: /community/i,
      managers:  /managers/i,
      analytics: /analytics/i,
      payment:   /payment/i,
      more:      /more/i,
    };
    await this.page.getByRole("tab", { name: tabMap[tab] }).click();
    await this.page.waitForLoadState("networkidle");
  }

  async selectGuestsSubTab(sub: GuestsSubTab) {
    const labelMap: Record<GuestsSubTab, RegExp> = {
      guests:      /^guests$/i,
      requests:    /join requests|requests/i,
      invited:     /invited/i,
      "track-rsvp": /track rsvp|responses/i,
    };
    const btn = this.page.getByRole("button", { name: labelMap[sub] }).first();
    if (await btn.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await btn.click();
      await this.page.waitForTimeout(600);
    }
  }

  // ── Overview ──────────────────────────────────────────────────────────────

  async expectEventName(name: string) {
    await expect(this.page.getByText(name).first()).toBeVisible({ timeout: 8_000 });
  }

  async expectOverviewStat(label: RegExp, value?: RegExp) {
    const el = this.page.getByText(label).first();
    await expect(el).toBeVisible({ timeout: 8_000 });
    if (value) {
      await expect(this.page.getByText(value).first()).toBeVisible({ timeout: 5_000 });
    }
  }

  async clickInterestedCount() {
    const row = this.page.getByText(/interested|guests?\s*\/|going/i).first();
    await row.click();
    await this.page.waitForTimeout(600);
  }

  async getGuestCount(): Promise<number> {
    const text = await this.page.getByText(/\d+ guests?/i).first().textContent();
    return parseInt(text?.match(/\d+/)?.[0] ?? "0", 10);
  }

  // ── Guest list ────────────────────────────────────────────────────────────

  async expectGuestVisible(nameOrEmail: string) {
    await expect(this.page.getByText(nameOrEmail).first()).toBeVisible({ timeout: 8_000 });
  }

  async expectGuestCount(min: number) {
    const rows = this.page.locator('[data-testid="guest-row"], [class*="guest-row"], table tbody tr').filter({ hasNotText: /no guests/i });
    await expect(rows).toHaveCount(min, { timeout: 8_000 });
  }

  // ── Join requests (approval events) ──────────────────────────────────────

  async approveFirstRequest() {
    const btn = this.page.getByRole("button", { name: /approve|accept/i }).first();
    await expect(btn).toBeVisible({ timeout: 8_000 });
    await btn.click();
    await this.page.waitForTimeout(800);
  }

  async rejectFirstRequest() {
    const btn = this.page.getByRole("button", { name: /reject|decline/i }).first();
    await expect(btn).toBeVisible({ timeout: 8_000 });
    await btn.click();
    await this.page.waitForTimeout(800);
  }

  // ── Date-undecided Join Requests ──────────────────────────────────────────

  async expectRsvpLabelPill(label: "Interested" | "Maybe" | "Not going") {
    await expect(
      this.page.getByText(label).first()
    ).toBeVisible({ timeout: 8_000 });
  }

  async expectNoApproveRejectButtons() {
    await expect(
      this.page.getByRole("button", { name: /^approve$/i }).first()
    ).not.toBeVisible({ timeout: 3_000 });
    await expect(
      this.page.getByRole("button", { name: /^reject$/i }).first()
    ).not.toBeVisible({ timeout: 3_000 });
  }

  // ── Invite ────────────────────────────────────────────────────────────────

  async inviteGuestByEmail(email: string) {
    const inviteBtn = this.page.getByRole("button", { name: /invite|add guest/i }).first();
    await inviteBtn.click();
    await this.page.waitForTimeout(400);

    const emailInput = this.page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await emailInput.fill(email);
    await this.page.waitForTimeout(200);

    const send = this.page.getByRole("button", { name: /send invite|invite|confirm/i }).first();
    await send.click();
    await this.page.waitForTimeout(800);
  }

  async expectInviteSent() {
    await expect(
      this.page.getByText(/invited|invite sent|success/i).first()
    ).toBeVisible({ timeout: 6_000 });
  }

  // ── Community sub-tabs ────────────────────────────────────────────────────

  async selectCommunityInnerTab(tab: "photos" | "reel") {
    const label = tab === "reel" ? /highlight reel/i : /gallery/i;
    await this.page.getByRole("button", { name: label }).click();
  }

  async clickGenerateReel() {
    await this.page.getByRole("button", { name: /generate.*reel|create.*reel/i }).click();
  }

  async expectReelModal() {
    await expect(this.page.getByText(/generate event reel/i)).toBeVisible({ timeout: 5_000 });
  }
}
