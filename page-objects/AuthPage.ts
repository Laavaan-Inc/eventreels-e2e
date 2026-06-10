import { Page, expect } from "@playwright/test";

export class AuthPage {
  constructor(private page: Page) {}

  async navigate() {
    // Use "commit" so we don't block waiting for analytics scripts to fire "load"
    await this.page.goto("/auth", { waitUntil: "commit" });
    await this.page.waitForLoadState("domcontentloaded");
    // Wait for the phone input to actually be interactive
    await this.page.locator("#phone").waitFor({ state: "visible", timeout: 15_000 });
  }

  async fillPhone(phone: string) {
    const digits = phone.replace(/^\+1/, "").replace(/\D/g, "");
    const input = this.page.locator("#phone");
    await input.clear();
    // Type slowly so each keystroke is visible in the live screenshot
    await input.pressSequentially(digits, { delay: 80 });
  }

  async clickSendCode() {
    const btn = this.page.getByRole("button", { name: /send code/i }).first();
    await btn.waitFor({ state: "visible", timeout: 10_000 });
    await btn.click();
  }

  async fillOtp(code: string) {
    const input = this.page.locator("#otp");
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.pressSequentially(code, { delay: 120 });
    // handleOtpChange auto-submits 400ms after all 6 digits are entered.
    // Wait 800ms to ensure the auto-submit has fired before returning.
    await this.page.waitForTimeout(800);
  }

  async waitForRedirectFromAuth() {
    // Poll every 500ms for either: redirect away from /auth, or profile form (#fullName).
    // Uses polling instead of event-based waits because the dev API can take 40+ s to respond.
    await this.page.waitForFunction(
      () =>
        !window.location.pathname.includes("/auth") ||
        !!document.querySelector("#fullName"),
      { timeout: 60_000, polling: 500 },
    );

    if (!this.page.url().includes("/auth")) return;

    // Profile screen is showing — fill and submit
    const nameInput = this.page.locator("#fullName");
    // Use locator.evaluate so React's synthetic event system picks up the change
    await nameInput.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(el, "E2E Test");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const letsGoBtn = this.page.getByRole("button", { name: /let.s go/i }).first();
    await expect(letsGoBtn).toBeEnabled({ timeout: 5_000 });
    await letsGoBtn.click();

    await this.page.waitForURL(
      (url) => !url.pathname.includes("/auth"),
      { timeout: 30_000, waitUntil: "commit" },
    );
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
    // If rate-limited, the error shows instead of OTP — surface a clear message
    const rateLimited = await this.page.getByText(/too many requests/i).isVisible({ timeout: 2_000 }).catch(() => false);
    if (rateLimited) throw new Error("Rate limited — too many requests to /auth/login. Wait a minute and retry.");
    await expect(this.page.locator("#otp")).toBeVisible({ timeout: 15_000 });
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
    await this.page.waitForURL(
      /(\/explore|\/dashboard|\/[a-z0-9_-]+\/[a-z0-9_-]+)/,
      { timeout: 20_000, waitUntil: "domcontentloaded" },
    );
  }
}
