/**
 * auth.spec.ts — All authentication flows
 *
 * Runs WITHOUT saved auth state (exercises real OTP UI).
 * Session-persistence tests use test.use({ storageState }) inline.
 */

import { test, expect } from "../fixtures/traced-test";
import { AuthPage } from "../page-objects/AuthPage";
import {
  AUTH_PHONE_VALID, AUTH_PHONE_INVALID, AUTH_PHONE_RESEND, AUTH_PHONE_RETRY,
} from "../config/test-data";

test.describe("Login — valid OTP", () => {
  test("valid bypass OTP redirects away from /auth", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.fillPhone(AUTH_PHONE_VALID);
    await auth.clickSendCode();
    await auth.expectOtpInput();
    await auth.fillOtp("000000");
    await auth.waitForRedirectFromAuth();
    expect(page.url()).not.toContain("/auth");
  });
});

test.describe("Login — invalid OTP", () => {
  test("wrong OTP shows error message", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.fillPhone(AUTH_PHONE_INVALID);
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
    await auth.fillPhone(AUTH_PHONE_RESEND);
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

  test("unauthenticated user on /create is redirected to /auth", async ({ browser }) => {
    const ctx = await browser.newContext(); // no storageState
    const pg = await ctx.newPage();
    await pg.goto("/create");
    // Auth guard fires after isLoading resolves — wait for the redirect
    await pg.waitForURL((url) => url.pathname.includes("/auth"), {
      timeout: 10_000,
      waitUntil: "commit",
    });
    expect(pg.url()).toContain("/auth");
    expect(pg.url()).toContain("callbackUrl");
    await ctx.close();
  });
});

test.describe("Login — OTP retry", () => {
  test("wrong OTP followed by correct OTP authenticates successfully", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigate();
    await auth.fillPhone(AUTH_PHONE_RETRY);
    await auth.clickSendCode();
    await auth.expectOtpInput();

    // First attempt — wrong code
    await auth.fillOtp("999999");
    await auth.expectErrorMessage();

    // Wait for OTP field to be re-interactable
    const otpInput = page.locator("#otp");
    await otpInput.waitFor({ state: "visible", timeout: 5_000 });
    await otpInput.clear();

    // Second attempt — correct bypass code
    await auth.fillOtp("000000");
    await auth.waitForRedirectFromAuth();
    expect(page.url()).not.toContain("/auth");
  });
});
