import { Page, expect } from "@playwright/test";

export class CheckInPage {
  constructor(private page: Page) {}

  async navigate(eventId: string) {
    await this.page.goto(`/check-in?eventId=${eventId}`);
    await this.page.waitForLoadState("networkidle");
  }

  /** Switch to manual code-entry mode (bypasses camera) */
  async switchToManualMode() {
    const manualBtn = this.page.getByRole("button", { name: /manual|type.*code|enter.*code/i }).first();
    if (await manualBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await manualBtn.click();
    } else {
      // May be a tab
      const manualTab = this.page.getByRole("tab", { name: /manual/i }).first();
      if (await manualTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await manualTab.click();
      }
    }
  }

  async enterTicketCode(code: string) {
    const input = this.page
      .locator('input[placeholder*="ticket" i], input[placeholder*="code" i], input[type="text"]')
      .first();
    await input.fill(code);
  }

  async submitCode() {
    await this.page.getByRole("button", { name: /check.?in|verify|submit|validate/i }).first().click();
  }

  async expectCheckInSuccess() {
    await expect(
      this.page.getByText(/checked.?in|success|valid/i).first()
    ).toBeVisible({ timeout: 8_000 });
  }

  async expectCheckInError() {
    await expect(
      this.page.getByText(/invalid|not found|already|error/i).first()
    ).toBeVisible({ timeout: 8_000 });
  }

  async expectCheckedInGuestList() {
    await expect(
      this.page.getByText(/checked.?in|guests/i).first()
    ).toBeVisible({ timeout: 8_000 });
  }
}
