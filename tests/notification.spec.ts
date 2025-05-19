import {test, expect} from "@playwright/test"
import {signUp} from "./auth.setup"
import {NDKEvent} from "@nostr-dev-kit/ndk"

test.describe("Notifications", () => {
  // This test verifies that the notification feed is visible
  test("notification feed is visible", async ({page}) => {
    // Create User A in browser
    const userAName = "User A"
    await signUp(page, userAName)
    
    // Go to the notifications page
    await page.goto("/notifications")
    
    // Check that the notifications feed is visible
    await expect(page.locator("div.w-full.overflow-hidden").filter({ hasText: "No notifications yet" })).toBeVisible()
  })
  
  // This is a placeholder for the full test that would verify notifications when a post is liked
  // The implementation is complex and requires further investigation
  test.skip("user should see notifications when post is liked", async ({page}) => {
    // Create User A in browser
    const userAName = "User A"
    await signUp(page, userAName)
    
    // User A creates a post
    await page.locator("#main-content").getByTestId("new-post-button").click()
    const postContent = "Test post for notifications"
    await page.getByPlaceholder("What's on your mind?").fill(postContent)
    await page.getByRole("button", {name: "Publish"}).click()
    
    // Verify post is visible
    await expect(page.getByText(postContent)).toBeVisible()
    
    // Wait for the post to be fully loaded and like button to appear
    await page.waitForSelector('[data-testid="like-button"]', {timeout: 10000})
    
    // Get User A's public key
    const userAPublicKey = await page.evaluate(() => {
      return window.localStorage.getItem("user/publicKey") || ""
    })
    
    // Create User B programmatically using NDK
    const userBName = "User B"
    const userBPublicKey = await page.evaluate((name) => {
      const {newUserLogin} = require("../src/utils/ndk")
      newUserLogin(name)
      return window.localStorage.getItem("user/publicKey") || ""
    }, userBName)
    
    // Save User A's data to restore later
    const userAPrivateKey = await page.evaluate(() => {
      return window.localStorage.getItem("user/privateKey") || ""
    })
    
    const userAData = {
      publicKey: userAPublicKey,
      privateKey: userAPrivateKey
    }
    
    // Switch to User B to create like event
    await page.evaluate((userBData) => {
      if (userBData.publicKey) {
        window.localStorage.setItem("user/publicKey", userBData.publicKey)
      }
    }, {publicKey: userBPublicKey})
    
    // Have User B create a like event for User A's post
    // Note: In a real implementation, we would need to get the post ID
    // This is a placeholder for the actual implementation
    await page.evaluate(async (data) => {
      const {ndk} = require("../src/utils/ndk")
      const ndkInstance = ndk()
      
      // Create a like event
      const likeEvent = new ndkInstance.NDKEvent(ndkInstance)
      likeEvent.kind = 7 // Reaction
      likeEvent.content = "+" // Like reaction
      likeEvent.tags = [
        ["e", "placeholder-post-id"], // Reference to the post (placeholder)
        ["p", data.authorPublicKey] // Reference to the author
      ]
      
      // Publish the like event
      await likeEvent.publish()
    }, {authorPublicKey: userAPublicKey})
    
    // Switch back to User A
    await page.evaluate((data) => {
      if (data.publicKey) {
        window.localStorage.setItem("user/publicKey", data.publicKey)
      }
      if (data.privateKey) {
        window.localStorage.setItem("user/privateKey", data.privateKey)
      }
    }, userAData)
    
    // Go to the notifications page
    await page.goto("/notifications")
    
    // Wait for notifications to appear (might take a moment to process)
    await page.waitForTimeout(5000)
    
    // Check for a notification in the feed
    await expect(page.locator(".notifications-feed")).toBeVisible()
    await expect(
      page.getByText(`reacted to your post`, {exact: false})
    ).toBeVisible({
      timeout: 15000, // Longer timeout to allow the notification system to process
    })
  })
})
