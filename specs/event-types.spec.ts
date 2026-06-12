/**
 * event-types.spec.ts — All event creation types
 *
 * Every test mocks /events/add so no real S3 uploads or DB writes occur.
 * The intercepted request body is asserted to carry the correct payload.
 */

import { test, expect } from "../fixtures/traced-test";
import { CreateEventPage } from "../page-objects/CreateEventPage";

async function setup(page: any, fn: (c: CreateEventPage) => Promise<void>) {
  const c = new CreateEventPage(page);
  await c.navigate();
  const getBody = await c.mockEventCreateApi();
  await fn(c);
  return { c, getBody };
}

// ── Free event ─────────────────────────────────────────────────────────────────

test.describe("Free event", () => {
  test("form fills and redirects", async ({ page }) => {
    const { c } = await setup(page, (c) => c.fillRequiredFields("E2E Free Open Event"));
    await c.submitForm();
    await c.waitForEventPage();
    expect(page.url()).not.toContain("/create");
  });

  test("API payload has eventType=free", async ({ page }) => {
    const { c, getBody } = await setup(page, async (c) => {
      await c.fillRequiredFields("E2E Free Payload");
      await c.setTicketMode("free");
    });
    await c.submitForm();
    expect((await getBody())?.eventType).toBe("free");
  });

  test("submit without name stays on /create or shows validation error", async ({ page }) => {
    const c = new CreateEventPage(page);
    await c.navigate();
    await c.submitForm();
    const stayed = page.url().includes("/create");
    const errorVisible = await page.getByText(/title|name|required/i).first().isVisible({ timeout: 3_000 }).catch(() => false);
    expect(stayed || errorVisible).toBe(true);
  });
});

// ── Chip-in event ──────────────────────────────────────────────────────────────

test.describe("Chip-in event", () => {
  test("selecting chip-in shows amount input", async ({ page }) => {
    const c = new CreateEventPage(page);
    await c.navigate();
    await c.setTicketMode("chip");
    await expect(page.getByText(/suggested per person|chip|payment method/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test("API payload has eventType=chipin", async ({ page }) => {
    const { c, getBody } = await setup(page, async (c) => {
      await c.fillRequiredFields("E2E Chip-in Event");
      await c.setTicketMode("chip");
      await c.setChipAmount("15");
    });
    await c.submitForm();
    expect((await getBody())?.eventType).toBe("chipin");
  });
});

// ── Paid event ─────────────────────────────────────────────────────────────────

test.describe("Paid event", () => {
  test("selecting paid shows price input", async ({ page }) => {
    const c = new CreateEventPage(page);
    await c.navigate();
    await c.setTicketMode("paid");
    await expect(page.getByText(/price per ticket|stripe|ticket tier/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test("API payload has eventType=premium", async ({ page }) => {
    const { c, getBody } = await setup(page, async (c) => {
      await c.fillRequiredFields("E2E Paid Event");
      await c.setTicketMode("paid");
      await c.setTicketPrice("25");
    });
    await c.submitForm();
    expect((await getBody())?.eventType).toBe("premium");
  });
});

// ── Date undecided ─────────────────────────────────────────────────────────────

test.describe("Date undecided event", () => {
  test("'Decide date later' toggle is visible", async ({ page }) => {
    const c = new CreateEventPage(page);
    await c.navigate();
    await expect(page.getByText(/decide date later|let guests vote/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test("API payload has dateUndecided=true and no startDate", async ({ page }) => {
    const { c, getBody } = await setup(page, async (c) => {
      await c.fillEventName("E2E TBD Event");
      await c.uploadCoverImage();
      await c.selectVirtualLocation();
      await c.fillDescription("Date undecided test.");
      await c.setDateUndecided();
    });
    await c.submitForm();
    const body = await getBody();
    expect(body?.dateUndecided).toBe(true);
    expect(body?.startDate).toBeUndefined();
  });
});

// ── Event settings ─────────────────────────────────────────────────────────────

test.describe("Event settings", () => {
  test("event options section shows all key rows", async ({ page }) => {
    const c = new CreateEventPage(page);
    await c.navigate();
    // Settings are inline rows on the form — no separate settings sheet
    for (const text of [/require approval/i, /capacity/i, /visibility/i, /questionnaire/i]) {
      await expect(page.getByText(text).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("approval required — API payload has approvalRequired=true", async ({ page }) => {
    const { c, getBody } = await setup(page, async (c) => {
      await c.fillRequiredFields("E2E Approval Event");
      await c.openSettings();
      await c.toggleRequireApproval();
      await c.saveSettings();
    });
    await c.submitForm();
    expect((await getBody())?.approvalRequired).toBe(true);
  });

  test("link-only — API payload has isPrivate=true", async ({ page }) => {
    const { c, getBody } = await setup(page, async (c) => {
      await c.fillRequiredFields("E2E Link-Only Event");
      await c.openSettings();
      await c.setVisibility("link");
      await c.saveSettings();
    });
    await c.submitForm();
    expect((await getBody())?.isPrivate).toBe(true);
  });

  test("invite-only — API payload has isPrivate=true", async ({ page }) => {
    const { c, getBody } = await setup(page, async (c) => {
      await c.fillRequiredFields("E2E Invite-Only Event");
      await c.openSettings();
      await c.setVisibility("invite");
      await c.saveSettings();
    });
    await c.submitForm();
    expect((await getBody())?.isPrivate).toBe(true);
  });

  test("limited capacity — UI renders capacity segment", async ({ page }) => {
    const c = new CreateEventPage(page);
    await c.navigate();
    await c.openSettings();
    await c.setCapacityMode("limited");
    await expect(page.getByText(/👤 limited|limited/i).first()).toBeVisible({ timeout: 5_000 });
    await c.saveSettings();
  });

  test.skip("event password — feature removed from create form", async () => {
    // Event password is not available in the current create form UI.
  });
});

// ── Questionnaire ──────────────────────────────────────────────────────────────

test.describe("Questionnaire", () => {
  test("questionnaire button is on the create form", async ({ page }) => {
    const c = new CreateEventPage(page);
    await c.navigate();
    await expect(page.getByText(/📋.*questionnaire|questionnaire/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test("API payload includes questions array", async ({ page }) => {
    const { c, getBody } = await setup(page, async (c) => {
      await c.fillRequiredFields("E2E Questionnaire Event");
      await c.openQuestionnaire();
      await c.addQuestion("What brings you to this event?");
      await c.saveQuestionnaire();
    });
    await c.submitForm();
    const body = await getBody();
    expect(Array.isArray(body?.questions)).toBe(true);
  });
});

// ── Location types ─────────────────────────────────────────────────────────────

test.describe("Location", () => {
  test("virtual — renders meeting link input", async ({ page }) => {
    const c = new CreateEventPage(page);
    await c.navigate();
    await c.setLocationMode("virtual");
    await expect(page.getByPlaceholder(/zoom|meet|meeting link/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test("physical — renders address picker", async ({ page }) => {
    const c = new CreateEventPage(page);
    await c.navigate();
    await c.setLocationMode("physical");
    // LocationSection physical placeholder is "The Brooklyn Mirage"; class is location-input
    await expect(
      page.locator('input.location-input, input[placeholder*="Brooklyn" i], input[placeholder*="address" i]').first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("virtual — API payload has isVirtuel=true", async ({ page }) => {
    const { c, getBody } = await setup(page, async (c) => {
      await c.fillRequiredFields("E2E Virtual Event");
      await c.setLocationMode("virtual");
    });
    await c.submitForm();
    expect((await getBody())?.isVirtuel).toBe(true);
  });
});

// ── Edge cases ─────────────────────────────────────────────────────────────────

test.describe("Edge cases", () => {
  test("event name with special characters", async ({ page }) => {
    const { c } = await setup(page, (c) => c.fillRequiredFields("E2E Event: 50% Off & More! (2026)"));
    await c.submitForm();
    await c.waitForEventPage();
    expect(page.url()).not.toContain("/create");
  });

  test("long event name (100+ chars)", async ({ page }) => {
    const name = "E2E " + "Annual Summer Charity Fundraiser Gala ".repeat(4);
    const { c } = await setup(page, (c) => c.fillRequiredFields(name.slice(0, 120)));
    await c.submitForm();
    await c.waitForEventPage();
    expect(page.url()).not.toContain("/create");
  });
});
