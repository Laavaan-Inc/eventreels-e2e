import { Page, expect } from "@playwright/test";

type ProfileTab = "upcoming-events" | "tbd-events" | "hosting-events" | "past-events";

const TAB_LABELS: Record<ProfileTab, RegExp> = {
  "upcoming-events": /upcoming/i,
  "tbd-events":      /date tbd|tbd/i,
  "hosting-events":  /hosting/i,
  "past-events":     /past/i,
};

export class ProfilePage {
  constructor(private page: Page) {}

  async navigate(username?: string) {
    await this.page.goto(username ? `/profile/${username}` : "/profile");
    await this.page.waitForLoadState("networkidle");
  }

  async selectTab(tab: ProfileTab) {
    const label = TAB_LABELS[tab];
    const btn = this.page.getByRole("button", { name: label }).first();
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click();
    } else {
      await this.page.getByText(label).first().click();
    }
    await this.page.waitForTimeout(500);
  }

  async expectTabExists(tab: ProfileTab) {
    await expect(this.page.getByText(TAB_LABELS[tab]).first()).toBeVisible({ timeout: 8_000 });
  }

  async expectEventVisible(name: string) {
    await expect(this.page.getByText(name).first()).toBeVisible({ timeout: 8_000 });
  }

  async expectEventNotVisible(name: string) {
    await expect(this.page.getByText(new RegExp(name, "i"))).not.toBeVisible({ timeout: 3_000 });
  }

  async expectBadge(badge: "Interested" | "Maybe" | "Not going" | "Hosting") {
    await expect(this.page.getByText(badge).first()).toBeVisible({ timeout: 5_000 });
  }
}
