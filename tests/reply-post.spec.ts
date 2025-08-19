import {test, expect} from "@playwright/test"
import {signUp} from "./auth.setup"

test("user can view post details", async ({page}) => {
  await signUp(page)

  await page.locator("#main-content").getByTestId("new-post-button").click()
  const postContent = "Test post for viewing details"
  await page.getByRole("dialog").getByPlaceholder("What's on your mind?").fill(postContent)
  await page.getByRole("dialog").getByRole("button", {name: "Post"}).click()

  await expect(page.getByText(postContent).first()).toBeVisible()

  await page.getByText(postContent).first().click()

  await expect(page.url()).toContain("/note")

  await expect(page.getByText(postContent).first()).toBeVisible()
})
