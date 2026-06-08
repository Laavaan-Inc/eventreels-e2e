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
    const inp = this.page.locator('.event-title-input, textarea[placeholder*="Untitled" i]').first();
    await inp.click();
    await inp.fill(name);
  }

  async fillDescription(text: string) {
    const ph = this.page.getByText(/Click to add content with rich text/i).first();
    if (!(await ph.isVisible({ timeout: 3_000 }).catch(() => false))) return;
    await ph.click();
    const pm = this.page.locator('.ProseMirror').first();
    await pm.waitFor({ state: "visible", timeout: 6_000 });
    await pm.click();
    await this.page.keyboard.type(text);
    const save = this.page.locator('[role="dialog"] button:has-text("Save")').last();
    await save.waitFor({ state: "visible", timeout: 3_000 });
    await save.click();
    await this.page.waitForTimeout(500);
  }

  async selectVirtualLocation() {
    const btn = this.page.getByRole("button", { name: /🔗 virtual|virtual/i }).first();
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click(); await this.page.waitForTimeout(300);
    }
  }

  async uploadCoverImage() {
    const imgPath = path.resolve(__dirname, "../fixtures/assets/test-photo.jpg");
    const area = this.page.locator('text="Click to upload cover image"').first();
    const [chooser] = await Promise.all([
      this.page.waitForEvent("filechooser", { timeout: 5_000 }),
      area.click(),
    ]);
    await chooser.setFiles(imgPath);
    await this.page.waitForTimeout(1_500);
  }

  // ── Ticket mode ───────────────────────────────────────────────────────────

  async setTicketMode(mode: TicketMode) {
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
    await this.page.locator('input[placeholder*="enter amount" i]').first().fill(amount);
  }

  async setTicketPrice(price: string) {
    await this.page.locator('input[placeholder*="enter amount" i], input[placeholder*="$ enter" i]').first().fill(price);
  }

  // ── Date ─────────────────────────────────────────────────────────────────

  async setDateUndecided() {
    await this.page.getByText(/decide date later|let guests vote/i).first().click();
    await this.page.waitForTimeout(300);
  }

  // ── Location ──────────────────────────────────────────────────────────────

  async setLocationMode(mode: LocationMode) {
    const labels: Record<LocationMode, RegExp> = {
      virtual:  /🔗 virtual|virtual/i,
      physical: /📍 physical|physical/i,
    };
    const btn = this.page.getByRole("button", { name: labels[mode] }).first();
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click(); await this.page.waitForTimeout(300);
    }
  }

  // ── Settings sheet ────────────────────────────────────────────────────────

  async openSettings() {
    await this.page.getByText(/⚙️.*event settings|event settings/i).first().click();
    await this.page.waitForTimeout(500);
  }

  async setVisibility(mode: Visibility) {
    const labels: Record<Visibility, RegExp> = {
      open:   /🌐 open|open/i,
      link:   /🔗 link only|link/i,
      invite: /✉️ invite|invite only/i,
    };
    const btn = this.page.getByRole("button", { name: labels[mode] }).first();
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click(); await this.page.waitForTimeout(300);
    }
  }

  async setCapacityMode(mode: CapacityMode) {
    const labels: Record<CapacityMode, RegExp> = {
      limited:   /👤 limited|limited/i,
      unlimited: /∞ unlimited|unlimited/i,
    };
    const btn = this.page.getByRole("button", { name: labels[mode] }).first();
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click(); await this.page.waitForTimeout(300);
    }
  }

  async setEventPassword(password: string) {
    const inp = this.page.locator('input[placeholder*="password to join" i]').first();
    if (await inp.isVisible({ timeout: 3_000 }).catch(() => false)) await inp.fill(password);
  }

  async toggleRequireApproval() {
    await this.page.getByText(/require guest approval/i).first().click();
    await this.page.waitForTimeout(300);
  }

  async saveSettings() {
    await this.page.getByRole("button", { name: /save settings/i }).first().click();
    await this.page.waitForTimeout(400);
  }

  // ── Questionnaire ─────────────────────────────────────────────────────────

  async openQuestionnaire() {
    await this.page.getByText(/📋.*questionnaire|questionnaire/i).first().click();
    await this.page.waitForTimeout(500);
  }

  async addQuestion(text: string) {
    const addBtn = this.page.getByRole("button", { name: /add question|＋ question/i }).first();
    if (await addBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await addBtn.click(); await this.page.waitForTimeout(300);
    }
    const inp = this.page.locator('input[placeholder*="question" i]').last();
    if (await inp.isVisible({ timeout: 3_000 }).catch(() => false)) await inp.fill(text);
  }

  async saveQuestionnaire() {
    const btn = this.page.getByRole("button", { name: /save|done/i }).last();
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
    await this.page.getByRole("button", { name: /create|save|publish|next/i }).first().click();
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
