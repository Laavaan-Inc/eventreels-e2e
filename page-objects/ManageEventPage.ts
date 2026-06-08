import { Page, expect } from "@playwright/test";

export class ManageEventPage {
  constructor(private page: Page) {}

  async navigate(eventId: string) {
    await this.page.goto(`/manage?id=${eventId}`);
    await this.page.waitForLoadState("networkidle");
  }

  async selectTab(tab: "overview" | "guests" | "community" | "managers" | "analytics" | "payment" | "more") {
    const tabMap: Record<string, RegExp> = {
      overview: /overview/i,
      guests: /guests/i,
      community: /community/i,
      managers: /managers/i,
      analytics: /analytics/i,
      payment: /payment/i,
      more: /more/i,
    };
    await this.page.getByRole("tab", { name: tabMap[tab] }).click();
    await this.page.waitForLoadState("networkidle");
  }

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

  async expectEventName(name: string) {
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 8_000 });
  }

  async getGuestCount(): Promise<number> {
    const text = await this.page.getByText(/\d+ guests?/i).first().textContent();
    return parseInt(text?.match(/\d+/)?.[0] ?? "0", 10);
  }
}
