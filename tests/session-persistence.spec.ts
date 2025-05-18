import {test, expect} from "@playwright/test"
import {signUp} from "./auth.setup"

test.describe("Session persistence", () => {
  test("user remains logged in after refresh", async ({page}) => {
    const username = "Session Test User"
    await signUp(page, username)
    
    // Refresh the page
    await page.reload()
    
    // Verify user is still logged in
    await expect(page.getByText(username, {exact: true})).toBeVisible()
    await expect(
      page.locator("#main-content").getByTestId("new-post-button")
    ).toBeVisible()
  })

  test("can create post after refresh", async ({page}) => {
    await signUp(page)
    
    // Refresh the page
    await page.reload()
    
    // Create a post
    await page.locator("#main-content").getByTestId("new-post-button").click()
    const postContent = "Test post after refresh"
    await page.getByPlaceholder("What's on your mind?").fill(postContent)
    await page.getByRole("button", {name: "Publish"}).click()
    
    // Wait for the post to appear in the feed
    await expect(page.locator(".px-4").getByText(postContent, {exact: true})).toBeVisible()
  })

  test("can like post after refresh", async ({page}) => {
    await signUp(page)
    
    // Create a post first
    await page.locator("#main-content").getByTestId("new-post-button").click()
    const postContent = "Test post for liking after refresh"
    await page.getByPlaceholder("What's on your mind?").fill(postContent)
    await page.getByRole("button", {name: "Publish"}).click()
    
    // Refresh the page
    await page.reload()
    
    // Like the post
    await page.waitForSelector('[data-testid="like-button"]', {timeout: 5000})
    const likeButton = page.getByTestId("like-button")
    await expect(likeButton).toBeVisible()
    await likeButton.click()
    
    // Verify like count increased
    await expect(page.getByTestId("like-count")).toHaveText("1")
  })
}) 