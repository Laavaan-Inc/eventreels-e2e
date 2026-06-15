import { Page, expect } from "@playwright/test";
import * as path from "path";

type TicketMode   = "free" | "chip" | "paid";
type LocationMode = "virtual" | "physical";
type Visibility   = "open" | "link" | "invite";
type CapacityMode = "limited" | "unlimited";

export class CreateEventPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.addInitScript(() => {
      const SHIFT = 7 * 24 * 60 * 60 * 1000;
      const _now = Date.now.bind(Date);
      // @ts-ignore
      const _D = Date;
      class SD extends _D {
        constructor(...a: any[]) { super(...(a.length === 0 ? [_now() + SHIFT] : a) as []); }
        static now() { return _now() + SHIFT; }
      }
      SD.prototype = _D.prototype;
      Object.setPrototypeOf(SD, _D);
      // @ts-ignore
      window.Date = SD;
    });
    await this.page.goto("/create");
    await this.page.waitForLoadState("load");
    await this.page.waitForLoadState("networkidle").catch(() => {});
    await this.dismissCategoryPicker();
  }

  async dismissCategoryPicker() {
    const dialog = this.page.locator('[role="dialog"]').first();
    if (!(await dialog.isVisible({ timeout: 4_000 }).catch(() => false))) return;
    const skip = dialog.locator('button').filter({ hasText: /no category|skip/i }).first();
    if (await skip.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await skip.click(); await this.page.waitForTimeout(400); return;
    }
    const cards = dialog.locator('button[type="button"]:not([aria-label])');
    if (await cards.count() > 0) { await cards.first().click(); await this.page.waitForTimeout(500); }
  }

  // ── Basic fields ──────────────────────────────────────────────────────────

  async fillEventName(name: string) {
    const inp = this.page.locator('.event-title-input, textarea[placeholder*="Untitled" i], input[placeholder*="Untitled" i]').first();
    await inp.waitFor({ state: "visible", timeout: 10_000 });
    await inp.click();
    await inp.fill(name);
  }

  async fillDescription(text: string) {
    const descRow = this.page.locator('button').filter({ hasText: /Description/ }).first();
    if (!(await descRow.isVisible({ timeout: 3_000 }).catch(() => false))) return;
    await descRow.click();
    const ta = this.page
      .locator('textarea[placeholder*="Tell guests" i], textarea[placeholder*="say something" i]')
      .locator("visible=true").first();
    await ta.waitFor({ state: "visible", timeout: 6_000 });
    await ta.fill(text);
    const save = this.page.locator("button:visible").filter({ hasText: /^Save$/ }).first();
    await save.waitFor({ state: "visible", timeout: 3_000 });
    await save.click();
    await this.page.waitForTimeout(400);
  }

  async selectVirtualLocation() {
    const locationRow = this.page.locator('button').filter({ hasText: /^Location/ }).first();
    if (!(await locationRow.isVisible({ timeout: 3_000 }).catch(() => false))) return;
    await locationRow.click();
    const virtualBtn = this.page.locator("button:visible").filter({ hasText: /^Virtual$/ });
    await virtualBtn.first().waitFor({ state: "visible", timeout: 4_000 });
    await virtualBtn.first().click();
    const doneBtn = this.page.locator("button:visible").filter({ hasText: /^done$/i });
    if (await doneBtn.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await doneBtn.first().click();
    }
    await this.page.waitForTimeout(300);
  }

  async uploadCoverImage() {
    const imgPath = path.resolve(__dirname, "../fixtures/assets/test-photo.jpg");
    // Step 1: click the cover button — now opens an import picker modal
    const btn = this.page.getByRole("button", { name: /add cover/i }).first();
    await btn.waitFor({ state: "visible", timeout: 6_000 });
    await btn.click();

    // Step 2: pick "Choose photo" (not "Import poster") inside the picker modal
    const choosePhoto = this.page.locator("button:visible").filter({ hasText: /choose photo/i }).first();
    await choosePhoto.waitFor({ state: "visible", timeout: 4_000 });

    // Step 3: clicking "Choose photo" triggers the hidden file input
    const [chooser] = await Promise.all([
      this.page.waitForEvent("filechooser", { timeout: 5_000 }),
      choosePhoto.click(),
    ]);
    await chooser.setFiles(imgPath);
    await this.page.waitForTimeout(1_500);
  }

  // ── Ticket mode ───────────────────────────────────────────────────────────

  async setTicketMode(mode: TicketMode) {
    // Open the Tickets dialog (button has label "Tickets <current-mode> ›")
    await this.page.getByRole("button", { name: /^Tickets/i }).first().click();
    await this.page.waitForTimeout(400);
    // CEModal renders two [role="dialog"] elements: mobile (lg:hidden, invisible at 1280px) and
    // desktop (hidden lg:flex, visible). Always filter to the visible one.
    const dialog = this.page.locator('[role="dialog"]').filter({ visible: true }).first();
    await dialog.waitFor({ state: "visible", timeout: 4_000 });
    const labels: Record<TicketMode, string> = {
      free: "free",
      chip: "chip in",
      paid: "paid",
    };
    const btn = dialog.getByRole("button", { name: labels[mode], exact: true }).first();
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click(); await this.page.waitForTimeout(300);
    }
    // Leave dialog open — content (chip amount, Stripe UI) needs to be visible for assertions.
    // submitForm() closes any open dialog before clicking Create Event.
  }

  async setChipAmount(amount: string) {
    await this.page.locator('input[placeholder*="amount" i]').filter({ visible: true }).first().fill(amount);
  }

  async setTicketPrice(price: string) {
    // Paid events require Stripe. Click "connect" if not yet connected (fake connect).
    const connectBtn = this.page.getByRole("button", { name: /connect stripe|^connect$/i }).filter({ visible: true }).first();
    if (await connectBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await connectBtn.click();
      await this.page.waitForTimeout(1_500); // fake-connect delay
    }
    await this.page.locator('input[placeholder*="amount" i]').filter({ visible: true }).first().fill(price);
  }

  // ── Date ─────────────────────────────────────────────────────────────────

  async setDateUndecided() {
    await this.page.getByText(/decide date later|let guests vote/i).first().click();
    await this.page.waitForTimeout(300);
    // Fill the first date option — required or the form blocks submission with "Add at least one date option"
    const dateInput = this.page.locator('input[type="date"]').first();
    if (await dateInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await dateInput.fill("2027-06-15");
      await this.page.waitForTimeout(200);
    }
  }

  // ── Location ──────────────────────────────────────────────────────────────

  async setLocationMode(mode: LocationMode) {
    const locationRow = this.page.locator('button').filter({ hasText: /^Location/ }).first();
    if (await locationRow.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await locationRow.click(); await this.page.waitForTimeout(400);
    }
    const labels: Record<LocationMode, RegExp> = {
      virtual:  /^Virtual$/,
      physical: /^In-person$/,
    };
    const btn = this.page.locator("button:visible").filter({ hasText: labels[mode] }).first();
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click(); await this.page.waitForTimeout(300);
    }
  }

  // ── Settings (now inline rows, no single "settings sheet") ────────────────

  /** No-op: settings are now individual rows on the form, not a settings sheet. */
  async openSettings() {
    // Settings are now split across individual OptRow items.
    // Individual methods (setVisibility, setCapacityMode, etc.) open their own modals.
  }

  async setVisibility(mode: Visibility) {
    await this.page.getByRole("button", { name: /^Visibility/i }).first().click();
    await this.page.waitForTimeout(400);
    const dialog = this.page.locator('[role="dialog"]').filter({ visible: true }).first();
    await dialog.waitFor({ state: "visible", timeout: 4_000 });
    const labels: Record<Visibility, string> = {
      open:   "Public",
      link:   "Link only",
      invite: "Invite only",
    };
    // The buttons include description text in their accessible name, so don't use exact matching.
    await dialog.getByRole("button", { name: labels[mode] }).first().click();
    await this.page.waitForTimeout(300);
  }

  async setCapacityMode(mode: CapacityMode) {
    await this.page.getByRole("button", { name: /^Capacity/i }).first().click();
    await this.page.waitForTimeout(400);
    const dialog = this.page.locator('[role="dialog"]').filter({ visible: true }).first();
    await dialog.waitFor({ state: "visible", timeout: 4_000 });
    // Seg labels: "∞ Unlimited" and "Limited" (no emoji, "Limited" ≠ "Unlimited")
    const labels: Record<CapacityMode, string> = {
      limited:   "Limited",
      unlimited: "∞ Unlimited",
    };
    const btn = dialog.getByRole("button", { name: labels[mode], exact: true }).first();
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click(); await this.page.waitForTimeout(300);
    }
  }

  async setEventPassword(_password: string) {
    // Event password is not available in the current create form — no-op.
  }

  async toggleRequireApproval() {
    // The Require Approval row has a WTog toggle span as its last child.
    // Navigate from the label span up to the parent row div, then click the toggle.
    const labelSpan = this.page.locator('span', { hasText: 'Require Approval' }).first();
    const parentRow = labelSpan.locator('..');
    await parentRow.locator('span').last().click();
    await this.page.waitForTimeout(300);
  }

  async saveSettings() {
    // Close whatever modal is open with the "done" button — filter to visible to skip hidden mobile dialog copy
    const done = this.page.getByRole("button", { name: /^done$/i }).filter({ visible: true }).first();
    if (await done.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await done.click(); await this.page.waitForTimeout(400);
    }
  }

  // ── Questionnaire ─────────────────────────────────────────────────────────

  async openQuestionnaire() {
    await this.page.getByText(/questionnaire/i).first().click();
    await this.page.waitForTimeout(500);
  }

  async addQuestion(text: string) {
    const addBtn = this.page.getByRole("button", { name: /add question/i }).first();
    if (await addBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await addBtn.click(); await this.page.waitForTimeout(300);
    }
    const inp = this.page.locator('input[placeholder*="question" i]').last();
    if (await inp.isVisible({ timeout: 3_000 }).catch(() => false)) await inp.fill(text);
  }

  async saveQuestionnaire() {
    const btn = this.page.getByRole("button", { name: /^save$/i }).first();
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click(); await this.page.waitForTimeout(400);
    }
  }

  // ── API mock ──────────────────────────────────────────────────────────────

  /** Install route mock for /events/add; returns a getter for the captured body */
  async mockEventCreateApi(): Promise<() => Promise<any>> {
    let captured: any = null;
    await this.page.route("**/events/add", async (route) => {
      if (route.request().method() !== "POST") { await route.continue(); return; }
      try { captured = JSON.parse(route.request().postData() || "{}"); } catch {}
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          _id: "e2e-test-event-id", shortCode: "e2e-test",
          eventName: captured?.eventName || "E2E Test Event",
          creatorId: { name: "user1", username: "user1" },
          eventType: captured?.eventType || "free",
          isPrivate: false,
        }),
      });
    });
    return () => Promise.resolve(captured);
  }

  async fillRequiredFields(eventName: string) {
    await this.fillEventName(eventName);
    await this.uploadCoverImage();
    await this.selectVirtualLocation();
    await this.fillDescription("E2E test event description.");
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async submitForm() {
    // Close any open Radix dialog (e.g. tickets/location left open for UI assertions) before clicking submit
    const openDialog = this.page.locator('[role="dialog"]').filter({ visible: true }).first();
    if (await openDialog.isVisible({ timeout: 500 }).catch(() => false)) {
      const doneBtn = openDialog.locator('button').filter({ hasText: /^done$/i }).first();
      if (await doneBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await doneBtn.click();
      } else {
        await this.page.keyboard.press('Escape');
      }
      await this.page.waitForTimeout(400);
    }
    const createBtn = this.page.getByRole("button", { name: /^(create event|save event)$/i }).first();
    await createBtn.waitFor({ state: "visible", timeout: 5_000 });
    await createBtn.click();
  }

  async waitForEventPage() {
    await this.page.waitForURL(/\/(manage|e|[a-z0-9_-]+\/[a-z0-9_-]+)/, { timeout: 20_000 });
  }

  async expectCreateForm() {
    await expect(
      this.page.locator('.event-title-input, textarea[placeholder*="Untitled" i]').first()
    ).toBeVisible({ timeout: 8_000 });
  }
}
