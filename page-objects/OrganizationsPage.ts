import { Page, expect } from "@playwright/test";

export class OrganizationsPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto("/organizations");
    await this.page.waitForLoadState("networkidle");
  }

  async navigateViaProfile() {
    // Orgs may be under the user profile page
    await this.page.goto("/profile");
    await this.page.waitForLoadState("networkidle");
    const orgsTab = this.page.getByRole("tab", { name: /organization/i });
    if (await orgsTab.isVisible()) await orgsTab.click();
  }

  async clickCreateOrg() {
    const btn = this.page
      .getByRole("button", { name: /create.*org|new org|request.*org/i })
      .first();
    await btn.click();
  }

  async fillOrgName(name: string) {
    await this.page.getByLabel(/org.*name|name/i).first().fill(name);
  }

  async submitOrgForm() {
    await this.page.getByRole("button", { name: /submit|create|save/i }).last().click();
  }

  async expectOrgInList(name: string) {
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 8_000 });
  }
}
