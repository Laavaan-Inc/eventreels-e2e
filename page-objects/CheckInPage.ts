import { Page, expect } from "@playwright/test";

export class CheckInPage {
  constructor(private page: Page) {}

  async navigate(eventId: string) {
    await this.page.goto(`/check-in?eventId=${eventId}`);
    await this.page.waitForLoadState("networkidle");
  }

  /** Open the Scan dialog then switch to Manual Entry mode */
  async switchToManualMode() {
    // The ticket input lives inside a Dialog — open it first via the header "Scan" button
    const scanBtn = this.page.getByRole("button", { name: /^scan$/i }).first();
    if (await scanBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await scanBtn.click();
      await this.page.waitForTimeout(400);
    }
    // Switch to Manual Entry inside the dialog
    const manualBtn = this.page.getByRole("button", { name: /manual entry/i }).first();
    if (await manualBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await manualBtn.click();
      await this.page.waitForTimeout(400);
    }
  }

  async enterTicketCode(code: string) {
    const input = this.page.locator('#ticket-code');
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.fill(code);
  }

  async submitCode() {
    // The check button has no text (icon only) — press Enter on the input instead
    const input = this.page.locator('#ticket-code');
    if (await input.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await input.press('Enter');
    }
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
