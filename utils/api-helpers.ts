/** Direct HTTP helpers — backend calls without going through the browser */

import { API_BASE, AUTH_STATE_PATH, SEEDED_EVENTS_PATH } from "../config/test-data";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function apiFetch(method: string, path: string, body?: object, token?: string, retry = 3): Promise<any> {
  for (let attempt = 1; attempt <= retry; attempt++) {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (res.status === 429) {
      if (attempt < retry) {
        await sleep(2_000 * attempt); // 2s, 4s backoff
        continue;
      }
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json();
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function loginUser(phone: string, otp = "000000"): Promise<{ token: string; user: any }> {
  await apiFetch("POST", "/auth/login", { phone });
  const data = await apiFetch("POST", "/auth/verify", { phone, code: otp });

  let accessToken: string = data.accessToken;
  let user = data.user;

  if (data.goTo === "new") {
    const profile = await apiFetch(
      "POST",
      "/auth/complete-profile",
      {
        fullName: `Test User ${phone.slice(-4)}`,
        email: `test${phone.slice(-4)}@e2e.test`,
        emailVerified: true,
      },
      accessToken
    );
    accessToken = profile.accessToken ?? accessToken;
    user = profile.user ?? user;
  }

  return { token: accessToken, user };
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function createFixedEvent(token: string, name: string, coverBase64?: string): Promise<any> {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dayAfter  = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return apiFetch("POST", "/events/add", {
    eventName: name,
    description: "E2E seed event",
    sections: [{ name: "Description", content: "E2E seed event" }],
    startDate: tomorrow.toISOString(),
    endDate:   dayAfter.toISOString(),
    timezoneOffsetInMin: new Date().getTimezoneOffset(),
    isVirtuel: true, isPrivate: false, capacity: 0,
    approvalRequired: false, isGuestListPublic: true,
    eventType: "free", accentColor: "#FFFFFF",
    ...(coverBase64 ? { coverPicture: coverBase64 } : {}),
  }, token);
}

export async function createApprovalEvent(token: string, name: string, coverBase64?: string): Promise<any> {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dayAfter  = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return apiFetch("POST", "/events/add", {
    eventName: name,
    description: "E2E approval event",
    sections: [{ name: "Description", content: "E2E approval event" }],
    startDate: tomorrow.toISOString(),
    endDate:   dayAfter.toISOString(),
    timezoneOffsetInMin: new Date().getTimezoneOffset(),
    isVirtuel: true, isPrivate: true, capacity: 50,
    approvalRequired: true, isGuestListPublic: false,
    eventType: "free", accentColor: "#FFFFFF",
    ...(coverBase64 ? { coverPicture: coverBase64 } : {}),
  }, token);
}

export async function createDateUndecidedEvent(token: string, name: string, coverBase64?: string): Promise<any> {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dayAfter  = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return apiFetch("POST", "/events/add", {
    eventName: name,
    description: "E2E date-undecided seed event",
    sections: [{ name: "Description", content: "E2E date-undecided seed event" }],
    startDate: tomorrow.toISOString(),
    endDate:   dayAfter.toISOString(),
    timezoneOffsetInMin: new Date().getTimezoneOffset(),
    isVirtuel: true, isPrivate: false, capacity: 0,
    approvalRequired: false, isGuestListPublic: true,
    eventType: "free", accentColor: "#FFFFFF",
    dateUndecided: true,
    ...(coverBase64 ? { coverPicture: coverBase64 } : {}),
  }, token);
}

export async function registerForEvent(token: string, eventId: string): Promise<any> {
  return apiFetch("POST", "/events/handle-invite-link", {
    eventId, status: "going", plusOnes: 0, plusOnesNames: [],
  }, token).catch(() => null);
}

export async function rsvpDateUndecided(token: string, eventId: string, status: "going" | "maybe" | "cancel"): Promise<void> {
  await apiFetch("POST", "/participants/update-rsvp", { eventId, status }, token);
}

export async function getPendingRequests(token: string, eventId: string): Promise<any[]> {
  const data = await apiFetch("POST", "/participants/get-pending", { eventId }, token);
  return Array.isArray(data) ? data : [];
}

// ── Stored state ──────────────────────────────────────────────────────────────

export function getStoredToken(): string {
  const { readFileSync } = require("fs");
  const state = JSON.parse(readFileSync(AUTH_STATE_PATH, "utf8"));
  const entry = state.origins?.[0]?.localStorage?.find((e: any) => e.name === "token");
  return entry?.value ?? "";
}

export function getSeededEvents(): Record<string, string> {
  const { readFileSync, existsSync } = require("fs");
  if (!existsSync(SEEDED_EVENTS_PATH)) return {};
  return JSON.parse(readFileSync(SEEDED_EVENTS_PATH, "utf8"));
}
