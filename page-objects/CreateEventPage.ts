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
    await this.page.waitForLoadState("networkidle");
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
    // The event name input has placeholder="Event Name" (large heading input)
    const inp = this.page.locator('input[placeholder="Event Name"]').first();
    await inp.waitFor({ state: "visible", timeout: 10_000 });
    await inp.click();
    await inp.fill(name);
  }

  async fillDescription(text: string) {
    // Click the "Add Description" row to open the richtext modal
    const row = this.page.getByText(/Add Description/i).first();
    if (!(await row.isVisible({ timeout: 3_000 }).catch(() => false))) return;
    await row.click();
    // Fill the plain textarea in the description modal
    const ta = this.page.locator('textarea[placeholder*="Doors"]').first();
    await ta.waitFor({ state: "visible", timeout: 6_000 });
    await ta.fill(text);
    // Click the "save" lime button to close the modal
    const save = this.page.getByRole("button", { name: /^save$/i }).first();
    await save.waitFor({ state: "visible", timeout: 3_000 });
    await save.click();
    await this.page.waitForTimeout(500);
  }

  async selectVirtualLocation() {
    await this.setLocationMode("virtual");
    // Close the modal so the location is committed as "Online"
    const done = this.page.getByRole("button", { name: /^done$/i }).first();
    if (await done.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await done.click(); await this.page.waitForTimeout(300);
    }
  }

  async uploadCoverImage() {
    const imgPath = path.resolve(__dirname, "../fixtures/assets/test-photo.jpg");
    // The "＋ Add Cover" button (full-width ＋ character) triggers the hidden file input
    const btn = this.page.getByRole("button", { name: /add cover/i }).first();
    const [chooser] = await Promise.all([
      this.page.waitForEvent("filechooser", { timeout: 5_000 }),
      btn.click(),
    ]);
    await chooser.setFiles(imgPath);
    await this.page.waitForTimeout(1_500);
  }

  // ── Ticket mode ───────────────────────────────────────────────────────────

  async setTicketMode(mode: TicketMode) {
    // Click the "Tickets" label span — click bubbles up to the parent OptRow div's onClick
    await this.page.locator('span').filter({ hasText: /^Tickets$/ }).first().click();
    await this.page.waitForTimeout(400);
    // Select the segment button inside the tickets modal
    const labels: Record<TicketMode, RegExp> = {
      free: /🎁 free|free/i,
      chip: /💸 chip in|chip/i,
      paid: /💳 paid|paid/i,
    };
    const btn = this.page.getByRole("button", { name: labels[mode] }).first();
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click(); await this.page.waitForTimeout(300);
    }
  }

  async setChipAmount(amount: string) {
    await this.page.locator('input[placeholder="$ amount"]').first().fill(amount);
  }

  async setTicketPrice(price: string) {
    // Paid events require Stripe. Click "connect" if not yet connected (fake connect).
    const connectBtn = this.page.getByRole("button", { name: /connect stripe|^connect$/i }).first();
    if (await connectBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await connectBtn.click();
      await this.page.waitForTimeout(1_500); // fake-connect delay
    }
    await this.page.locator('input[placeholder="$ amount"]').first().fill(price);
  }

  // ── Date ─────────────────────────────────────────────────────────────────

  async setDateUndecided() {
    await this.page.getByText(/decide date later|let guests vote/i).first().click();
    await this.page.waitForTimeout(300);
  }

  // ── Location ──────────────────────────────────────────────────────────────

  async setLocationMode(mode: LocationMode) {
    // Open the location modal (row label changes from "Add Event Location" to the location name once set)
    const locationRow = this.page.getByText(/Add Event Location|Online/i).first();
    if (await locationRow.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await locationRow.click(); await this.page.waitForTimeout(400);
    }
    // Select virtual or in-person segment inside the modal
    const labels: Record<LocationMode, RegExp> = {
      virtual:  /🔗 Virtual|Virtual/i,
      physical: /📍 In-person|In-person/i,
    };
    const btn = this.page.getByRole("button", { name: labels[mode] }).first();
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click(); await this.page.waitForTimeout(300);
    }
    // Modal stays open — caller closes with saveSettings()/done if needed
  }

  // ── Settings (now inline rows, no single "settings sheet") ────────────────

  /** No-op: settings are now individual rows on the form, not a settings sheet. */
  async openSettings() {
    // Settings are now split across individual OptRow items.
    // Individual methods (setVisibility, setCapacityMode, etc.) open their own modals.
  }

  async setVisibility(mode: Visibility) {
    // Open the Visibility modal
    await this.page.getByText("Visibility").first().click();
    await this.page.waitForTimeout(400);
    // Click the option div in the visibility modal (these are divs, not buttons)
    const labels: Record<Visibility, RegExp> = {
      open:   /^Public$/,
      link:   /^Link only$/,
      invite: /^Invite only$/,
    };
    await this.page.getByText(labels[mode]).first().click();
    await this.page.waitForTimeout(300);
  }

  async setCapacityMode(mode: CapacityMode) {
    // Open the Capacity modal (click the label span — bubbles to parent OptRow div)
    await this.page.locator('span').filter({ hasText: /^Capacity$/ }).first().click();
    await this.page.waitForTimeout(400);
    const labels: Record<CapacityMode, RegExp> = {
      limited:   /👤 Limited|Limited/i,
      unlimited: /∞ Unlimited|Unlimited/i,
    };
    const btn = this.page.getByRole("button", { name: labels[mode] }).first();
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click(); await this.page.waitForTimeout(300);
    }
    // Modal stays open — caller closes with saveSettings() if needed
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
    // Close whatever modal is open with the "done" button
    const done = this.page.getByRole("button", { name: /^done$/i }).first();
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
    await this.mockEventCreateApi();
    await this.fillEventName(eventName);
    await this.uploadCoverImage();
    await this.selectVirtualLocation();
    await this.fillDescription("E2E test event description.");
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async submitForm() {
    // Close any open modal first — the modal overlay blocks the Create Event button
    const doneOrClose = this.page.getByRole("button", { name: /^done$|^save$|^✕$/i }).first();
    if (await doneOrClose.isVisible({ timeout: 500 }).catch(() => false)) {
      await doneOrClose.click(); await this.page.waitForTimeout(300);
    }
    await this.page.getByRole("button", { name: /create event|creating/i }).first().click();
  }

  async waitForEventPage() {
    await this.page.waitForURL(/\/(manage|e|[a-z0-9_-]+\/[a-z0-9_-]+)/, { timeout: 20_000 });
  }

  async expectCreateForm() {
    await expect(
      this.page.locator('input[placeholder="Event Name"]').first()
    ).toBeVisible({ timeout: 8_000 });
  }
}
