import { Page, expect } from "@playwright/test";

export class AuthPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto("/auth");
    await this.page.waitForLoadState("networkidle");
  }

  async fillPhone(phone: string) {
    const digits = phone.replace(/^\+1/, "").replace(/\D/g, "");
    await this.page.locator("#phone").clear();
    await this.page.locator("#phone").fill(digits);
  }

  async clickSendCode() {
    await this.page.getByRole("button", { name: /send code/i }).click();
  }

  async fillOtp(code: string) {
    await this.page.locator("#otp").fill(code);
    const verifyBtn = this.page.locator(
      'button:has-text("Verify Code"), button:has-text("Verify"), button[type="submit"]'
    ).first();
    if (await verifyBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await verifyBtn.click();
    } else {
      await this.page.waitForTimeout(700);
    }
  }

  async fillProfileName(name: string) {
    await this.page.locator("#fullName").fill(name);
  }

  async fillProfileEmail(email: string) {
    await this.page.locator("#email").fill(email);
  }

  async clickCompleteProfile() {
    await this.page.getByRole("button", { name: /complete profile|save|continue/i }).click();
  }

  async logout() {
    const avatar = this.page.locator('img[alt*="avatar"], [data-testid="user-avatar"], [aria-label*="account" i]').first();
    if (await avatar.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await avatar.click();
    } else {
      const menuBtn = this.page.locator('nav button, header button').last();
      await menuBtn.click();
    }
    await this.page.waitForTimeout(400);
    const logoutBtn = this.page.getByRole("button", { name: /log.*out|sign.*out|logout/i }).first();
    if (await logoutBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await logoutBtn.click();
    } else {
      await this.page.evaluate(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("isAuth");
      });
      await this.page.reload();
    }
    await this.page.waitForTimeout(800);
  }

  async expectOtpInput() {
    await expect(this.page.locator("#otp")).toBeVisible();
  }

  async expectResendTimer() {
    await expect(this.page.getByText(/resend in|resend code/i)).toBeVisible();
  }

  async expectErrorMessage() {
    await expect(
      this.page.getByText(/invalid|incorrect|wrong|expired|error/i).first()
    ).toBeVisible({ timeout: 8_000 });
  }

  async waitForDashboardOrExplore() {
    await this.page.waitForURL(/(\/explore|\/dashboard|\/[a-z0-9_-]+\/[a-z0-9_-]+)/, { timeout: 20_000 });
  }
}
