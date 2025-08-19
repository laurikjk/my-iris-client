import {test, expect} from "@playwright/test"
import {signUp} from "./auth.setup"

test.describe("Session persistence", () => {
  test("user remains logged in after refresh", async ({page}) => {
    const username = "Session Test User"
    await signUp(page, username)

    // Refresh the page
    await page.reload()

    // Wait for the page to load and profile to be fetched
    await page.waitForLoadState("networkidle")

    // Verify user is still logged in
    await expect(page.getByText(username, {exact: true})).toBeVisible({timeout: 10000})
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
    await page.getByRole("dialog").getByPlaceholder("What's on your mind?").fill(postContent)
    await page.getByRole("dialog").getByRole("button", {name: "Post"}).click()

    // Wait for the post to appear in the feed
    await expect(
      page.locator(".px-4").getByText(postContent, {exact: true}).first()
    ).toBeVisible()
  })

  test("can like post after refresh", async ({page}) => {
    await signUp(page)

    // Create a post first
    await page.locator("#main-content").getByTestId("new-post-button").click()
    const postContent = "Test post for liking after refresh"
    await page.getByRole("dialog").getByPlaceholder("What's on your mind?").fill(postContent)
    await page.getByRole("dialog").getByRole("button", {name: "Post"}).click()

    // Refresh the page
    await page.reload()

    // Like the post - find the specific post we created
    await page.waitForSelector('[data-testid="like-button"]', {timeout: 5000})
    const postElement = page.getByText(postContent).first().locator("..").locator("..")
    const likeButton = postElement.getByTestId("like-button").first()
    await expect(likeButton).toBeVisible()
    await likeButton.click()

    // Verify like count increased
    await expect(postElement.getByTestId("like-count").first()).toHaveText("1")
  })
})
