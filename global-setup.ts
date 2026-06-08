/**
 * global-setup.ts
 *
 * Runs once before all specs:
 *  1. Authenticates the organizer test user via bypass OTP
 *  2. Seeds fixture events (fixed, approval-required, dateUndecided)
 *  3. Seeds RSVP records on the TBD event using secondary test users
 *  4. Writes .auth/user.json  (Playwright storageState)
 *  5. Writes .auth/seeded-events.json  (event IDs for specs to read)
 */

import { FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
  API_BASE, TEST_PHONE, TEST_OTP, TEST_NAME, TEST_EMAIL,
  TEST_PHONE_2, TEST_PHONE_3, TEST_PHONE_4,
  AUTH_STATE_PATH, SEEDED_EVENTS_PATH,
} from "./config/test-data";
import {
  loginUser,
  createFixedEvent,
  createApprovalEvent,
  createDateUndecidedEvent,
  rsvpDateUndecided,
  registerForEvent,
} from "./utils/api-helpers";

export default async function globalSetup(_config: FullConfig) {
  fs.mkdirSync(".auth", { recursive: true });

  // ── 1. Authenticate organizer ─────────────────────────────────────────────
  console.log("\n[setup] Authenticating organizer...");
  const { token, user } = await loginUser(TEST_PHONE, TEST_OTP);
  if (!token) throw new Error("[setup] No access token — is the backend running on :3001?");
  console.log(`[setup] Authenticated: ${user?.name ?? "?"} (@${user?.username})`);

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
      seeded[`${key}EventShortCode`] = ev.shortCode ?? "";
      console.log(`[setup] ${key} event: ${seeded[`${key}EventId`]}`);
    } catch (err: any) {
      console.log(`[setup] ${key} event skipped: ${err?.message}`);
    }
  }

  // ── 4. Seed RSVPs on TBD event (login each secondary user once, reuse token) ─
  const secondaryTokens: Record<string, string> = {};

  if (seeded.tbdEventId) {
    for (const [phone, status, label] of [
      [TEST_PHONE_2, "going",  "Interested"],
      [TEST_PHONE_3, "maybe",  "Maybe"],
      [TEST_PHONE_4, "cancel", "Not going"],
    ] as const) {
      try {
        await new Promise(r => setTimeout(r, 1_200)); // avoid 429 between logins
        const { token: t } = await loginUser(phone);
        secondaryTokens[phone] = t;
        await rsvpDateUndecided(t, seeded.tbdEventId, status);
        console.log(`[setup] ${phone} → ${label}`);
      } catch (err: any) {
        console.log(`[setup] RSVP ${label} skipped: ${err?.message}`);
      }
    }
  }

  // ── 5. Seed registration on fixed event — reuse token from step 4 ──────────
  if (seeded.fixedEventId) {
    try {
      // Reuse TEST_PHONE_2 token if already obtained, else login fresh
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
  console.log("[setup] Seeded events →", SEEDED_EVENTS_PATH);

  // ── 7. Write Playwright storageState (reuse organizer token from step 1) ──
  // Use the token already obtained — avoid an extra login call
  const finalToken = token;
  const finalUser  = user;
  const refreshToken = ""; // refresh token not returned separately

  const storageState = {
    cookies: [{
      name: "token", value: finalToken,
      domain: "localhost", path: "/",
      expires: Math.floor(Date.now() / 1000) + 7 * 86400,
      httpOnly: false, secure: false, sameSite: "Lax" as const,
    }],
    origins: [{
      origin: "http://localhost:3000",
      localStorage: [
        { name: "token",         value: finalToken },
        { name: "refresh_token", value: refreshToken },
        { name: "id",            value: String(finalUser?.id ?? "") },
        { name: "name",          value: String(finalUser?.name ?? TEST_NAME) },
        { name: "username",      value: String(finalUser?.username ?? "") },
        { name: "phone",         value: String(finalUser?.phone ?? TEST_PHONE) },
        { name: "avatar",        value: String(finalUser?.avatar ?? "") },
        { name: "email",         value: String(finalUser?.email ?? TEST_EMAIL) },
        { name: "role",          value: String(finalUser?.role ?? "1") },
        { name: "isAuth",        value: "true" },
      ],
    }],
  };

  fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify(storageState, null, 2));
  console.log("[setup] Auth state →", AUTH_STATE_PATH, "\n");
}
