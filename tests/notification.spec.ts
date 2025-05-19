import {test, expect} from "@playwright/test"
import {signUp} from "./auth.setup"

test.describe("Notifications", () => {
  test.skip("user should see notifications when post is liked", async ({page}) => {
    // Create User A in browser
    await signUp(page, "User A")
    
    await page.goto("/notifications")
    
    await expect(page.locator(".notifications-feed")).toBeVisible()
  })
})
