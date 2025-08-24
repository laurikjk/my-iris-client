import {test, expect} from "@playwright/test"
import {signUp} from "./auth.setup"

test.describe("Reply draft persistence", () => {
  test("should persist reply draft after page reload", async ({page}) => {
    // Sign up first
    await signUp(page)

    // Create a post to reply to
    await page.locator("#main-content").getByTestId("new-post-button").click()
    await page
      .getByRole("dialog")
      .getByPlaceholder("What's on your mind?")
      .fill("Post to reply to")
    await page.getByRole("dialog").getByRole("button", {name: "Post"}).click()

    // Wait for the post to appear and click on it
    await page.waitForTimeout(2000)
    await expect(page.getByText("Post to reply to")).toBeVisible()
    await page.getByText("Post to reply to").first().click()
    await page.waitForURL(/\/note/)

    // Type a draft reply
    const replyDraft = "This is my draft reply that should persist"
    await page.getByPlaceholder("Write your reply...").fill(replyDraft)

    // Reload the page
    await page.reload()
    await page.waitForLoadState("networkidle")

    // Check that reply draft is preserved
    await expect(page.getByPlaceholder("Write your reply...")).toHaveValue(replyDraft)
  })

  test("should keep main draft separate from reply drafts", async ({page}) => {
    // Sign up first
    await signUp(page)

    // Create a main draft
    await page.locator("#main-content").getByTestId("new-post-button").click()
    const mainDraft = "This is the main draft content"
    await page
      .getByRole("dialog")
      .getByPlaceholder("What's on your mind?")
      .fill(mainDraft)
    await page.keyboard.press("Escape")

    // Create a post to reply to (publish a different post first)
    await page.locator("#main-content").getByTestId("new-post-button").click()
    // The main draft should still be there, clear it and write new post
    await page.getByRole("dialog").getByPlaceholder("What's on your mind?").clear()
    await page
      .getByRole("dialog")
      .getByPlaceholder("What's on your mind?")
      .fill("Post to reply to")
    await page.getByRole("dialog").getByRole("button", {name: "Post"}).click()
    await page.waitForTimeout(2000)

    // Now recreate the main draft since it was cleared
    await page.locator("#main-content").getByTestId("new-post-button").click()
    await page
      .getByRole("dialog")
      .getByPlaceholder("What's on your mind?")
      .fill(mainDraft)
    await page.keyboard.press("Escape")

    // Click on post to open standalone view and create a reply draft
    await page.getByText("Post to reply to").first().click()
    await page.waitForURL(/\/note/)
    const replyDraft = "This is a reply draft"
    await page.getByPlaceholder("Write your reply...").fill(replyDraft)

    // Reload the page
    await page.reload()
    await page.waitForLoadState("networkidle")

    // Check that main draft is still there
    await page.locator("#main-content").getByTestId("new-post-button").click()
    await expect(
      page.getByRole("dialog").getByPlaceholder("What's on your mind?")
    ).toHaveValue(mainDraft)
    await page.keyboard.press("Escape")

    // Check that reply draft is still there
    await page.getByText("Post to reply to").first().click()
    await page.waitForURL(/\/note/)
    await expect(page.getByPlaceholder("Write your reply...")).toHaveValue(replyDraft)
  })

  test("should clear reply draft after publishing reply", async ({page}) => {
    // Sign up first
    await signUp(page)

    // Create a post to reply to
    await page.locator("#main-content").getByTestId("new-post-button").click()
    await page
      .getByRole("dialog")
      .getByPlaceholder("What's on your mind?")
      .fill("Post to reply to")
    await page.getByRole("dialog").getByRole("button", {name: "Post"}).click()
    await page.waitForTimeout(1000)

    // Click on post to open standalone view
    await page.getByText("Post to reply to").first().click()
    await page.waitForURL(/\/note/)

    // Type and publish reply
    const replyContent = "This reply will be published"
    await page.getByPlaceholder("Write your reply...").fill(replyContent)
    await page.getByRole("button", {name: "Reply"}).click()
    await page.waitForTimeout(1000)

    // Check reply draft is cleared
    await expect(page.getByPlaceholder("Write your reply...")).toHaveValue("")
  })
})
