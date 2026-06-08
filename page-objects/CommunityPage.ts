import { Page, expect } from "@playwright/test";

export class CommunityPage {
  constructor(private page: Page) {}

  /** Navigate to an org's community feed */
  async navigate(orgSlug: string) {
    await this.page.goto(`/${orgSlug}/community`);
    await this.page.waitForLoadState("networkidle");
  }

  // ── New Post ──────────────────────────────────────────────────────────────

  async openNewPostDialog() {
    const btn = this.page
      .getByRole("button", { name: /new post|create.*post|post/i })
      .first();
    await btn.click();
    // Wait for dialog to appear
    await expect(
      this.page.getByText(/new post/i).first()
    ).toBeVisible({ timeout: 5_000 });
  }

  async fillPostCaption(caption: string) {
    const descField = this.page.locator("#post-desc, textarea[placeholder*='caption' i], textarea[placeholder*='say something' i]").first();
    await descField.fill(caption);
  }

  async attachPhoto(photoPath: string) {
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent("filechooser"),
      this.page
        .locator('input[type="file"]')
        .first()
        .dispatchEvent("click"),
    ]);
    await fileChooser.setFiles(photoPath);
  }

  async submitPost() {
    await this.page
      .getByRole("button", { name: /post to community|post/i })
      .last()
      .click();
  }

  async expectPostVisible(caption: string) {
    await expect(
      this.page.getByText(caption).first()
    ).toBeVisible({ timeout: 10_000 });
  }

  async expectPostCreatedToast() {
    await expect(
      this.page.getByText(/posted|success/i).first()
    ).toBeVisible({ timeout: 8_000 });
  }

  // ── Reactions (upvote / downvote) ─────────────────────────────────────────

  /** Click the upvote (thumbs-up / ▲) button on the first post */
  async upvoteFirstPost() {
    const upBtn = this.page
      .locator('[aria-label*="upvote" i], [aria-label*="like" i], button:has(svg[data-lucide="thumbs-up"])')
      .first();
    if (await upBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await upBtn.click();
    } else {
      // Score number or chevron-up — look for the first vote button near a post card
      const voteBtn = this.page.locator('button[data-vote], button.vote, button:near(.post-card)').first();
      await voteBtn.click();
    }
  }

  /** Click the downvote (thumbs-down / ▼) button on the first post */
  async downvoteFirstPost() {
    const downBtn = this.page
      .locator('[aria-label*="downvote" i], button:has(svg[data-lucide="thumbs-down"])')
      .first();
    if (await downBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await downBtn.click();
    }
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  /** Open the post thread to access the comment input.
   *  Clicks the comment icon on the first visible post card. */
  async openFirstPostThread() {
    const commentIcon = this.page
      .locator('a[href*="/community/post/"], [aria-label*="comment" i], svg[data-lucide="message-square"]')
      .first();
    await commentIcon.click();
    await this.page.waitForLoadState("networkidle");
  }

  async fillCommentInput(text: string) {
    const input = this.page
      .locator('input[placeholder*="comment" i], textarea[placeholder*="comment" i]')
      .first();
    await input.fill(text);
  }

  async submitComment() {
    // Send button (lucide Send icon button) or Enter key
    const sendBtn = this.page
      .locator('button:has(svg[data-lucide="send"]), button[aria-label*="send" i]')
      .first();
    if (await sendBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await sendBtn.click();
    } else {
      await this.page
        .locator('input[placeholder*="comment" i]')
        .first()
        .press("Enter");
    }
  }

  async expectCommentVisible(text: string) {
    await expect(
      this.page.getByText(text).first()
    ).toBeVisible({ timeout: 8_000 });
  }

  // ── Share ─────────────────────────────────────────────────────────────────

  async openShareOptions() {
    const shareBtn = this.page
      .locator('[aria-label*="share" i], button:has(svg[data-lucide="share"])')
      .first();
    if (await shareBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await shareBtn.click();
    }
  }

  async expectShareOptionsVisible() {
    await expect(
      this.page.getByText(/instagram|tiktok|linkedin|copy.*link|share/i).first()
    ).toBeVisible({ timeout: 5_000 });
  }
}
