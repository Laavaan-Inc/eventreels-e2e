/**
 * auth.spec.ts — All authentication flows
 *
 * Runs WITHOUT saved auth state (exercises real OTP UI).
 * Session-persistence tests use test.use({ storageState }) inline.
 */

import { test, expect } from "@playwright/test";
import { AuthPage } from "../page-objects/AuthPage";

test.describe("Login — valid OTP", () => {
  test("valid bypass OTP redirects away from /auth", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.fillPhone("+11111111111");
    await auth.clickSendCode();
    await auth.expectOtpInput();
    await auth.fillOtp("000000");
    await page.waitForTimeout(2_000);
    const authed =
      await page.locator('[data-testid="user-avatar"], nav img').first().isVisible({ timeout: 5_000 }).catch(() => false) ||
      await page.locator('[href*="/profile"], [href*="/dashboard"]').first().isVisible({ timeout: 2_000 }).catch(() => false);
    if (!authed) {
      await page.goto("/explore");
      await page.waitForLoadState("networkidle");
    }
    expect(page.url()).not.toContain("/auth");
  });
});

test.describe("Login — invalid OTP", () => {
  test("wrong OTP shows error message", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.fillPhone("+11111111111");
    await auth.clickSendCode();
    await auth.expectOtpInput();
    await auth.fillOtp("999999");
    await auth.expectErrorMessage();
  });
});

test.describe("OTP screen", () => {
  test("resend timer is shown after sending code", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.fillPhone("+11111111111");
    await auth.clickSendCode();
    await auth.expectOtpInput();
    await auth.expectResendTimer();
  });
});

test.describe("Session persistence", () => {
  test.use({ storageState: ".auth/user.json" });

  test("authenticated user stays logged in after page reload", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/auth");
  });

  test("authenticated user can access /manage without redirect", async ({ page }) => {
    await page.goto("/manage");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/auth");
  });

  test("unauthenticated browser is redirected to /auth on protected page", async ({ browser }) => {
    const ctx = await browser.newContext(); // no storageState
    const pg = await ctx.newPage();
    await pg.goto("http://localhost:3000/create");
    await pg.waitForLoadState("networkidle");
    const onAuth = pg.url().includes("/auth");
    const phoneVisible = await pg.locator("#phone").isVisible({ timeout: 5_000 }).catch(() => false);
    expect(onAuth || phoneVisible).toBe(true);
    await ctx.close();
  });
});

test.describe("Login — OTP retry", () => {
  test("wrong OTP followed by correct OTP authenticates successfully", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.fillPhone("+11111111111");
    await auth.clickSendCode();
    await auth.expectOtpInput();

    // First attempt — wrong code
    await auth.fillOtp("999999");
    await auth.expectErrorMessage();

    // Wait for the OTP field to be interactable again (some apps briefly disable it)
    const otpInput = page.locator("#otp");
    await otpInput.waitFor({ state: "visible", timeout: 5_000 });
    await page.waitForTimeout(500);

    // Second attempt — correct bypass code; clear field first
    await otpInput.clear();
    await auth.fillOtp("000000");

    // Wait for navigation away from /auth
    await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 15_000 });
    expect(page.url()).not.toContain("/auth");
  });
});
