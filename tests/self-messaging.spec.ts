import {test, expect} from "@playwright/test"

test.describe("Self-messaging between browser sessions", () => {
  test("should sync messages between two sessions with same key", async ({browser}) => {
    test.setTimeout(15000) // 15 second timeout for the whole test
    // Test data
    const testKey = "nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5"
    const timestamp = Date.now()
    const testMessage1 = `Test message 1: ${timestamp}`
    const testMessage2 = `Test message 2: ${timestamp}`

    // Create two browser contexts (sessions)
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    try {
      // Login to both sessions with same key
      await page1.goto("/")
      await page1.waitForLoadState("networkidle")
      await page1.getByPlaceholder("nsec, npub, nip-05 or hex private key").fill(testKey)
      await page1.getByRole("button", {name: "Continue"}).click()
      await page1.waitForURL("/feed")

      await page2.goto("/")
      await page2.waitForLoadState("networkidle")
      await page2.getByPlaceholder("nsec, npub, nip-05 or hex private key").fill(testKey)
      await page2.getByRole("button", {name: "Continue"}).click()
      await page2.waitForURL("/feed")

      // Navigate to chats on both pages
      await page1.getByRole("link", {name: "Chats"}).click()
      await page1.waitForLoadState("networkidle")

      await page2.getByRole("link", {name: "Chats"}).click()
      await page2.waitForLoadState("networkidle")

      // Page 1: Start a chat with self
      await page1.getByRole("link", {name: /New chat/i}).click()
      await page1.waitForLoadState("networkidle")

      // Search for self - the test key's public key
      const selfPubKey = "npub1g53mukxnjkcmr94fhryzkqutdz2ukq4ks0gvy5af25rgmwsl4ngq43drvk"
      await page1.getByPlaceholder("Search users").fill(selfPubKey)
      await page1.waitForTimeout(1000) // Wait for search results

      // Click on self in search results
      await page1.locator(`text=${selfPubKey}`).first().click()
      await page1.waitForLoadState("networkidle")

      // Send first message from page1
      const messageInput1 = page1.getByPlaceholder("Message")
      await messageInput1.fill(testMessage1)
      await messageInput1.press("Enter")

      // Verify message appears on page1
      await expect(page1.locator(`text="${testMessage1}"`)).toBeVisible({timeout: 3000})

      // Page 2: Navigate to the self chat
      await page2.goto(page1.url()) // Use same URL as page1
      await page2.waitForLoadState("networkidle")

      // Verify message from page1 appears on page2
      await expect(page2.locator(`text="${testMessage1}"`)).toBeVisible({timeout: 5000})

      // Send second message from page2
      const messageInput2 = page2.getByPlaceholder("Message")
      await messageInput2.fill(testMessage2)
      await messageInput2.press("Enter")

      // Verify message appears on page2
      await expect(page2.locator(`text="${testMessage2}"`)).toBeVisible({timeout: 3000})

      // Verify message from page2 appears on page1
      await expect(page1.locator(`text="${testMessage2}"`)).toBeVisible({timeout: 5000})
    } finally {
      await context1.close()
      await context2.close()
    }
  })
})
