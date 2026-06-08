import { Page, expect } from "@playwright/test";

type RsvpStatus = "going" | "maybe" | "cancel";

const RSVP_LABELS: Record<RsvpStatus, RegExp> = {
  going:  /interested|going|attend/i,
  maybe:  /maybe/i,
  cancel: /not going|cancel/i,
};

export class EventPage {
  constructor(private page: Page) {}

  async navigate(username: string, eventId: string) {
    await this.page.goto(`/${username}/e/${eventId}`);
    await this.page.waitForLoadState("networkidle");
  }

  async expectEventLoaded(name: string) {
    await expect(this.page.getByText(name).first()).toBeVisible({ timeout: 10_000 });
  }

  async clickRsvpOption(status: RsvpStatus) {
    await this.page.getByRole("button", { name: RSVP_LABELS[status] }).first().click();
    await this.page.waitForTimeout(800);
  }

  async expectConfirmDateButton() {
    await expect(
      this.page.getByRole("button", { name: /confirm date/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  }

  async clickConfirmDate() {
    await this.page.getByRole("button", { name: /confirm date/i }).first().click();
    await expect(
      this.page.getByText(/select.*date|pick.*date|start date/i).first()
    ).toBeVisible({ timeout: 6_000 });
  }

  async expectApproveGuestsButton() {
    await expect(
      this.page.getByRole("button", { name: /approve guests/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  }

  async clickRegister() {
    await this.page.getByRole("button", { name: /register|rsvp|join|attend/i }).first().click();
    await this.page.waitForTimeout(500);
  }
}
