import {test, expect} from "@playwright/test"
import {signUp} from "./auth.setup"

test("user can create a new post", async ({page}) => {
  // First sign up
  await signUp(page)

  // Click the new post button
  await page.locator("#main-content").getByTestId("new-post-button").click()

  // Fill in the post content
  const postContent = "Hello, this is my first post!"
  await page.getByPlaceholder("What's on your mind?").fill(postContent)

  // Click publish
  await page.getByRole("button", {name: "Publish"}).click()

  // Verify we're redirected to the new post page and content is visible
  await expect(page.getByText(postContent)).toBeVisible()
})
