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
  let refreshToken = "";
  let user: any = null;

  if (fs.existsSync(AUTH_STATE_PATH)) {
    try {
      const stored = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, "utf8"));
      const ls = stored.origins?.[0]?.localStorage ?? [];
      const t  = ls.find((e: any) => e.name === "token")?.value ?? "";
      if (t) {
        token        = t;
        refreshToken = ls.find((e: any) => e.name === "refresh_token")?.value ?? "";
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

  // Validate the stored token — if it expired or expiring within 60 min, re-login
  // We check the JWT exp directly (fast, no network) and also ping the API.
  if (token) {
    let needsRefresh = false;
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      const expiresIn = (payload.exp ?? 0) * 1000 - Date.now();
      if (expiresIn < 60 * 60 * 1000) {
        console.log(`[setup] Token expires in ${Math.round(expiresIn / 60000)} min — re-authenticating...`);
        needsRefresh = true;
      }
    } catch { needsRefresh = true; }

    if (!needsRefresh && !(await checkTokenValid(token))) {
      console.log(`[setup] Stored token invalid — re-authenticating...`);
      needsRefresh = true;
    }

    if (needsRefresh) {
      token = "";
      user  = null;
      fs.rmSync(AUTH_STATE_PATH, { force: true });
    }
  }

  if (!token) {
    console.log(`\n[setup] Authenticating organizer via API...`);
    const result = await loginUser(TEST_PHONE, TEST_OTP);
    token        = result.token;
    refreshToken = result.refreshToken;
    user         = result.user;
    if (!token) throw new Error("[setup] No access token — check API_BASE and bypass OTP");
    console.log(`[setup] Authenticated: ${user?.name ?? "?"} (@${user?.username})`);
  }

  // Persist organizer token in a simple file so beforeAll hooks can always read it
  fs.writeFileSync(".auth/organizer-token.json", JSON.stringify({ token }));

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

  // Always rewrite storageState with the correct APP_BASE origin.
  // When UI login runs against a different host (e.g. dev.eventreels.com), the
  // saved origin won't match localhost:3000 — Playwright would ignore that
  // localStorage entirely, leaving the test browser unauthenticated.
  {
    const appUrl       = new URL(APP_BASE);
    const cookieDomain = appUrl.hostname;
    const isHttps      = appUrl.protocol === "https:";

    // If we did a real UI login, merge the saved localStorage into the new state
    // so any extra keys the app wrote (avatar, etc.) are preserved.
    let existingLs: Array<{ name: string; value: string }> = [];
    if (uiLoginOk && fs.existsSync(AUTH_STATE_PATH)) {
      try {
        const saved = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, "utf8"));
        existingLs = saved.origins?.[0]?.localStorage ?? [];
      } catch {}
    }

    // Merge: known keys take precedence (they come from the fresh API token).
    const knownKeys = new Set(["token", "refresh_token", "id", "name", "username", "phone", "email", "role", "isAuth"]);
    const extraLs   = existingLs.filter((e) => !knownKeys.has(e.name));

    // Prefer freshly-fetched refreshToken; fall back to whatever was stored.
    const storedRefreshToken = refreshToken
      || existingLs.find((e) => e.name === "refresh_token")?.value
      || "";

    const storageState = {
      cookies: [{
        name: "token", value: token, domain: cookieDomain, path: "/",
        expires: Math.floor(Date.now() / 1000) + 7 * 86400,
        httpOnly: false, secure: isHttps, sameSite: "Lax" as const,
      }],
      origins: [{
        origin: APP_BASE,
        localStorage: [
          { name: "token",         value: token },
          { name: "refresh_token", value: storedRefreshToken },
          { name: "id",            value: String(user?.id ?? "") },
          { name: "name",          value: String(user?.name ?? TEST_NAME) },
          { name: "username",      value: String(user?.username ?? "") },
          { name: "phone",         value: String(user?.phone ?? TEST_PHONE) },
          { name: "email",         value: String(user?.email ?? TEST_EMAIL) },
          { name: "role",          value: String(user?.role ?? "1") },
          { name: "isAuth",        value: "true" },
          ...extraLs,
        ],
      }],
    };
    fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify(storageState, null, 2));
    console.log("[setup] Auth state written with origin:", APP_BASE);
  }

  // Auth-spec phones only need profile completion once — skip if already done
  const authPhonesFile = ".auth/auth-phones-done.json";
  if (!fs.existsSync(authPhonesFile)) {
    console.log("[setup] Pre-completing auth phone profiles...");
    const allTestPhones = [
      AUTH_PHONE_VALID, AUTH_PHONE_INVALID, AUTH_PHONE_RESEND, AUTH_PHONE_RETRY,
      // E2E spec phones used inline (must have profiles before tests run)
      "+15555500001", "+15555500002", "+15555500003",
      "+15555555551", "+15555555552", "+15555555553", "+15555555554",
    ];
    for (const phone of allTestPhones) {
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

  // ── 2. Reuse or create seeded events ─────────────────────────────────────
  // Reuse existing seeded-events.json if all three event IDs are present — this
  // avoids recreating events and re-logging secondary users on every run.
  let seeded: Record<string, string> = { organizerUsername: user?.username ?? "" };
  const existingSeeded = fs.existsSync(SEEDED_EVENTS_PATH)
    ? JSON.parse(fs.readFileSync(SEEDED_EVENTS_PATH, "utf8")) as Record<string, string>
    : {};

  // Re-seed if event IDs are missing OR the stored environment doesn't match the current one.
  const envChanged = existingSeeded.appBase && existingSeeded.appBase !== APP_BASE;
  const needsSeeding = !existingSeeded.fixedEventId || !existingSeeded.approvalEventId || !existingSeeded.tbdEventId || !!envChanged;
  if (!needsSeeding) {
    seeded = { ...existingSeeded, organizerUsername: user?.username ?? "" };
    console.log("[setup] Reusing seeded events (delete .auth/seeded-events.json to re-seed)");
    fs.writeFileSync(SEEDED_EVENTS_PATH, JSON.stringify(seeded, null, 2));
  } else {
    // ── Load cover image ─────────────────────────────────────────────────────
    let coverBase64: string | undefined;
    const imgPath = path.join("fixtures", "assets", "test-photo.jpg");
    if (fs.existsSync(imgPath)) coverBase64 = fs.readFileSync(imgPath).toString("base64");

    // ── Seed events ──────────────────────────────────────────────────────────
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

    // ── Seed RSVPs on TBD event ──────────────────────────────────────────────
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

    // ── Seed registration on fixed event ─────────────────────────────────────
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

    // ── Write seeded-events.json ──────────────────────────────────────────────
    seeded.appBase = APP_BASE;
    fs.writeFileSync(SEEDED_EVENTS_PATH, JSON.stringify(seeded, null, 2));
    console.log("[setup] Seeded events →", SEEDED_EVENTS_PATH);
  }

  console.log("[setup] Events ready →", SEEDED_EVENTS_PATH, "\n");
}
