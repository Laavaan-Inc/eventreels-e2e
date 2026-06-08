/** Central config — edit to point at your environment */

export const APP_BASE  = process.env.APP_BASE  ?? "http://localhost:3000";
export const API_BASE  = process.env.API_BASE  ?? "http://localhost:3001/api/v1";

// Main test user (organizer) — backend bypass: identical-digit US numbers
export const TEST_PHONE = "+11111111111";
export const TEST_OTP   = "000000";
export const TEST_NAME  = "E2E Test User";
export const TEST_EMAIL = "e2e-test@eventreels.com";

// Secondary bypass users (for RSVP seeding on dateUndecided events)
export const TEST_PHONE_2 = "+12222222222";
export const TEST_PHONE_3 = "+13333333333";
export const TEST_PHONE_4 = "+14444444444";

export const AUTH_STATE_PATH    = ".auth/user.json";
export const SEEDED_EVENTS_PATH = ".auth/seeded-events.json";

export const TIMEOUTS = {
  navigation:    10_000,
  networkIdle:    8_000,
  toast:          5_000,
  upload:        15_000,
  reelGeneration: 300_000,
};

export const TEST_PHOTO_PATH = "fixtures/assets/test-photo.jpg";

/** Google Sheets config — set via env vars or fill in directly */
export const SHEET_ID         = process.env.SHEET_ID ?? "";
export const SHEET_TAB        = process.env.SHEET_TAB ?? "E2E Results";
export const GOOGLE_SA_KEY    = process.env.GOOGLE_SA_KEY ?? ""; // JSON string of service-account key
