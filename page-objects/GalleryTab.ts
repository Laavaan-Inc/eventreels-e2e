import { Page, expect } from "@playwright/test";
import * as path from "path";

export class GalleryTab {
  constructor(private page: Page) {}

  async uploadPhoto(filePath: string) {
    const absPath = path.resolve(filePath);
    // Trigger the hidden file input — click the upload button/zone first
    const fileInput = this.page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(absPath);
  }

  async clickUploadButton() {
    const uploadBtn = this.page.getByRole("button", { name: /upload|add photo/i }).first();
    if (await uploadBtn.isVisible()) await uploadBtn.click();
  }

  async waitForUploadSuccess(timeout = 15_000) {
    // Wait for success toast or the photo to appear in the grid
    await expect(
      this.page.getByText(/uploaded|success|photo added/i).first()
    ).toBeVisible({ timeout });
  }

  async getPhotoCount(): Promise<number> {
    const photos = this.page.locator('img[src*="storage.googleapis"], img[src*="cdn"]');
    return photos.count();
  }

  async expectAtLeastOnePhoto() {
    await expect(this.page.locator('img[src*="storage.googleapis"], img[src*="cdn"]').first())
      .toBeVisible({ timeout: 10_000 });
  }
}
