import {test, expect} from "@playwright/test"
import {signUp} from "./auth.setup"

test.describe("Post liking", () => {
  test("user can like a post", async ({page}) => {
    // First sign up
    await signUp(page)

    // Create a post to like
    await page.locator("#main-content").getByTestId("new-post-button").click()
    const postContent = "Test post for liking"
    await page.getByPlaceholder("What's on your mind?").fill(postContent)
    await page.getByRole("button", {name: "Publish"}).click()

    // Verify post is visible
    await expect(page.getByText(postContent)).toBeVisible()

    // Wait for the post to be fully loaded and like button to appear
    await page.waitForSelector('[data-testid="like-button"]', {timeout: 5000})

    // Find and click the like button
    const likeButton = page.getByTestId("like-button")
    await expect(likeButton).toBeVisible()
    await likeButton.click()

    // Verify like count increased and heart is filled
    await expect(page.getByTestId("like-count")).toHaveText("1")
    await expect(page.getByTestId("like-button")).toHaveClass(/text-error/)
  })

  test("user can react with a custom emoji", async ({page}) => {
    // First sign up
    await signUp(page)

    // Create a post to react to
    await page.locator("#main-content").getByTestId("new-post-button").click()
    const postContent = "Test post for custom emoji reaction"
    await page.getByPlaceholder("What's on your mind?").fill(postContent)
    await page.getByRole("button", {name: "Publish"}).click()

    // Verify post is visible
    await expect(page.getByText(postContent)).toBeVisible()

    // Wait for the post to be fully loaded and like button to appear
    await page.waitForSelector('[data-testid="like-button"]', {timeout: 5000})

    const likeButton = page.getByTestId("like-button")
    await expect(likeButton).toBeVisible()

    const boundingBox = await likeButton.boundingBox()
    if (!boundingBox) {
      throw new Error("Could not get bounding box for like button")
    }
    await page.mouse.move(boundingBox.x + 25, boundingBox.y + 25)
    await page.mouse.down()
    await page.waitForTimeout(600) // Wait longer than the 500ms timeout

    // Verify emoji picker is visible
    await expect(page.locator(".emoji-mart")).toBeVisible()

    await page.locator(".emoji-mart-emoji").first().click()

    // Verify the emoji is displayed instead of the heart icon
    await page.mouse.up()

    // Wait for the reaction to be processed
    await page.waitForTimeout(500)

    // Verify the like button doesn't have the default heart icon
    await expect(
      page.locator('[data-testid="like-button"] svg[name="heart-solid"]')
    ).toHaveCount(0)

    // Verify some emoji content is visible in the like button
    await expect(page.locator('[data-testid="like-button"] span')).toBeVisible()
  })
})
