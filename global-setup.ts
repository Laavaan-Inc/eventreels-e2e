/**
 * global-setup.ts
 *
 * Runs once before all specs:
 *  1. Logs the organizer in through the REAL UI (phone → OTP → home)
 *     so storageState captures whatever the app actually sets on login.
 *  2. Seeds fixture events via API helpers (faster than UI, not what we're testing).
 *  3. Seeds RSVP records on the TBD event using secondary test users.
 *  4. Writes .auth/user.json  (Playwright storageState from real login)
 *  5. Writes .auth/seeded-events.json  (event IDs for specs to read)
 */

import { chromium, FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
  APP_BASE, TEST_PHONE, TEST_OTP, TEST_NAME, TEST_EMAIL,
  TEST_PHONE_2, TEST_PHONE_3, TEST_PHONE_4,
  AUTH_PHONE_VALID, AUTH_PHONE_INVALID, AUTH_PHONE_RESEND, AUTH_PHONE_RETRY,
  AUTH_STATE_PATH, SEEDED_EVENTS_PATH,
} from "./config/test-data";
import {
  loginUser,
  checkTokenValid,
  createFixedEvent,
  createApprovalEvent,
  createDateUndecidedEvent,
  rsvpDateUndecided,
  registerForEvent,
} from "./utils/api-helpers";

export default async function globalSetup(_config: FullConfig) {
  fs.mkdirSync(".auth", { recursive: true });

  // When only running auth tests, skip slow event seeding (login is still needed for storageState)
  const skipSeeding = process.env.SKIP_SEEDING === "true";

  // ── 1. Get API token (needed for seeding) ────────────────────────────────
  // Reuse the existing token from .auth/user.json if it's there — avoids
  // hammering /auth/login on every run and hitting the rate limit.
  let token = "";
  let user: any = null;

  if (fs.existsSync(AUTH_STATE_PATH)) {
    try {
      const stored = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, "utf8"));
      const ls = stored.origins?.[0]?.localStorage ?? [];
      const t  = ls.find((e: any) => e.name === "token")?.value ?? "";
      if (t) {
        token = t;
        user  = {
          username: ls.find((e: any) => e.name === "username")?.value ?? "",
          name:     ls.find((e: any) => e.name === "name")?.value ?? "",
          id:       ls.find((e: any) => e.name === "id")?.value ?? "",
          phone:    ls.find((e: any) => e.name === "phone")?.value ?? TEST_PHONE,
          email:    ls.find((e: any) => e.name === "email")?.value ?? TEST_EMAIL,
          role:     ls.find((e: any) => e.name === "role")?.value ?? "1",
          isAuth:   true,
        };
        console.log(`\n[setup] Reusing stored auth for @${user.username} (delete .auth/ to force re-login)`);
      }
    } catch {}
  }

  // Validate the stored token — if it expired, clear it and re-login
  if (token && !(await checkTokenValid(token))) {
    console.log(`[setup] Stored token expired — re-authenticating...`);
    token = "";
    user  = null;
    // Also clear auth state so UI login runs fresh
    fs.rmSync(AUTH_STATE_PATH, { force: true });
  }

  if (!token) {
    console.log(`\n[setup] Authenticating organizer via API...`);
    const result = await loginUser(TEST_PHONE, TEST_OTP);
    token = result.token;
    user  = result.user;
    if (!token) throw new Error("[setup] No access token — check API_BASE and bypass OTP");
    console.log(`[setup] Authenticated: ${user?.name ?? "?"} (@${user?.username})`);
  }

  // ── 2. Login through real UI to get authentic browser storageState ────────
  // Skip if we already have a valid storageState — UI login also hits /auth/login
  // and consumes rate-limit quota unnecessarily on repeat runs.
  let uiLoginOk = fs.existsSync(AUTH_STATE_PATH) && !!token;
  if (uiLoginOk) {
    console.log(`[setup] Skipping UI login — storageState already present`);
  } else {
    console.log(`[setup] Logging in via UI at ${APP_BASE}...`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page    = await context.newPage();

    try {
      await page.goto(`${APP_BASE}/auth`);
      await page.waitForLoadState("domcontentloaded");

      const phoneInput = page.locator("#phone");
      await phoneInput.waitFor({ state: "visible", timeout: 15_000 });
      await phoneInput.fill(TEST_PHONE.replace(/^\+1/, ""));

      await page.getByRole("button", { name: /send code/i }).first().click();

      const otpInput = page.locator("#otp");
      await otpInput.waitFor({ state: "visible", timeout: 15_000 });
      await otpInput.fill(TEST_OTP);

      const verifyBtn = page.getByRole("button", { name: /verify/i }).first();
      if (await verifyBtn.isEnabled({ timeout: 2_000 }).catch(() => false)) {
        await verifyBtn.click();
      }

      await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 20_000 });
      await context.storageState({ path: AUTH_STATE_PATH });
      console.log(`[setup] UI login OK — now at: ${page.url()}`);
      uiLoginOk = true;
    } catch (err: any) {
      console.log(`[setup] UI login failed (${err?.message}) — falling back to token injection`);
    }
    await browser.close();
  }

  // Fallback: inject token directly into storageState (same as before)
  if (!uiLoginOk) {
    const appUrl       = new URL(APP_BASE);
    const cookieDomain = appUrl.hostname;
    const isHttps      = appUrl.protocol === "https:";
    const storageState = {
      cookies: [{
        name: "token", value: token, domain: cookieDomain, path: "/",
        expires: Math.floor(Date.now() / 1000) + 7 * 86400,
        httpOnly: false, secure: isHttps, sameSite: "Lax" as const,
      }],
      origins: [{
        origin: APP_BASE,
        localStorage: [
          { name: "token",   value: token },
          { name: "id",      value: String(user?.id ?? "") },
          { name: "name",    value: String(user?.name ?? TEST_NAME) },
          { name: "username",value: String(user?.username ?? "") },
          { name: "phone",   value: String(user?.phone ?? TEST_PHONE) },
          { name: "email",   value: String(user?.email ?? TEST_EMAIL) },
          { name: "role",    value: String(user?.role ?? "1") },
          { name: "isAuth",  value: "true" },
        ],
      }],
    };
    fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify(storageState, null, 2));
    console.log("[setup] Auth state injected →", AUTH_STATE_PATH);
  }

  // Auth-spec phones only need profile completion once — skip if already done
  const authPhonesFile = ".auth/auth-phones-done.json";
  if (!fs.existsSync(authPhonesFile)) {
    console.log("[setup] Pre-completing auth phone profiles...");
    for (const phone of [AUTH_PHONE_VALID, AUTH_PHONE_INVALID, AUTH_PHONE_RESEND, AUTH_PHONE_RETRY]) {
      try {
        await new Promise(r => setTimeout(r, 3_000));
        await loginUser(phone);
        console.log(`[setup] ${phone} — profile ready`);
      } catch (err: any) {
        console.log(`[setup] ${phone} — skipped: ${err?.message}`);
      }
    }
    fs.writeFileSync(authPhonesFile, JSON.stringify({ done: true, at: new Date().toISOString() }));
  } else {
    console.log("[setup] Auth phone profiles already completed (delete .auth/auth-phones-done.json to redo)");
  }

  if (skipSeeding) {
    // Auth-only run — no events needed, write a minimal placeholder so specs don't crash
    const seeded = { organizerUsername: user?.username ?? "" };
    fs.writeFileSync(SEEDED_EVENTS_PATH, JSON.stringify(seeded, null, 2));
    console.log("[setup] Seeding skipped (SKIP_SEEDING=true)\n");
    return;
  }

  // ── 2. Load cover image ───────────────────────────────────────────────────
  let coverBase64: string | undefined;
  const imgPath = path.join("fixtures", "assets", "test-photo.jpg");
  if (fs.existsSync(imgPath)) coverBase64 = fs.readFileSync(imgPath).toString("base64");

  const seeded: Record<string, string> = { organizerUsername: user?.username ?? "" };

  // ── 3. Seed events ────────────────────────────────────────────────────────
  for (const [key, fn] of [
    ["fixed",    () => createFixedEvent(token, "E2E Free Event", coverBase64)],
    ["approval", () => createApprovalEvent(token, "E2E Approval Event", coverBase64)],
    ["tbd",      () => createDateUndecidedEvent(token, "E2E Date TBD Event", coverBase64)],
  ] as const) {
    try {
      const ev = await fn();
      seeded[`${key}EventId`]        = ev._id ?? ev.id ?? "";
      seeded[`${key}ShortCode`]      = ev.shortCode ?? "";
      console.log(`[setup] ${key} event: ${seeded[`${key}EventId`]} (${seeded[`${key}ShortCode`] || "no shortcode"})`);
    } catch (err: any) {
      console.log(`[setup] ${key} event skipped: ${err?.message}`);
    }
  }

  // ── 4. Seed RSVPs on TBD event ───────────────────────────────────────────
  const secondaryTokens: Record<string, string> = {};

  if (seeded.tbdEventId) {
    for (const [phone, status, label] of [
      [TEST_PHONE_2, "going",  "Interested"],
      [TEST_PHONE_3, "maybe",  "Maybe"],
      [TEST_PHONE_4, "cancel", "Not going"],
    ] as const) {
      try {
        await new Promise(r => setTimeout(r, 1_200));
        const { token: t } = await loginUser(phone);
        secondaryTokens[phone] = t;
        await rsvpDateUndecided(t, seeded.tbdEventId, status);
        console.log(`[setup] ${phone} → ${label}`);
      } catch (err: any) {
        console.log(`[setup] RSVP ${label} skipped: ${err?.message}`);
      }
    }
  }

  // ── 5. Seed registration on fixed event ──────────────────────────────────
  if (seeded.fixedEventId) {
    try {
      const t2 = secondaryTokens[TEST_PHONE_2] ?? (await (async () => {
        await new Promise(r => setTimeout(r, 1_200));
        const { token: t } = await loginUser(TEST_PHONE_2);
        return t;
      })());
      await registerForEvent(t2, seeded.fixedEventId);
      console.log("[setup] User 2 registered for fixed event");
    } catch (err: any) {
      console.log(`[setup] Fixed RSVP skipped: ${err?.message}`);
    }
  }

  // ── 6. Write seeded-events.json ───────────────────────────────────────────
  fs.writeFileSync(SEEDED_EVENTS_PATH, JSON.stringify(seeded, null, 2));
  console.log("[setup] Seeded events →", SEEDED_EVENTS_PATH, "\n");
}
