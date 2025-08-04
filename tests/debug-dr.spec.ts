import {test} from "@playwright/test"
import {signUp} from "./auth.setup"

test.describe("Debug Double Ratchet", () => {
  test("debug chat navigation and double ratchet setup", async ({page}) => {
    await signUp(page)

    // Take screenshot after signup
    await page.screenshot({path: "/tmp/playwright-debug/after-signup.png"})

    // Go to chats
    await page.getByRole("link", {name: "Chats"}).click()
    await page.waitForTimeout(2000)

    // Take screenshot of chats page
    await page.screenshot({path: "/tmp/playwright-debug/chats-page.png"})

    // Try to find New Chat header/link
    const newChatHeader = page.locator("header").getByText("New Chat")
    const isHeaderVisible = await newChatHeader.isVisible().catch(() => false)
    console.log("New Chat header visible:", isHeaderVisible)

    // Try alternative selectors
    const newChatLink = page.getByRole("link", {name: /New Chat/})
    const isLinkVisible = await newChatLink.isVisible().catch(() => false)
    console.log("New Chat link visible:", isLinkVisible)

    // Check page URL
    console.log("Current URL:", page.url())

    // Check for any errors in console
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("Console error:", msg.text())
      }
    })

    // Take screenshot of full page
    await page.screenshot({
      path: "/tmp/playwright-debug/chats-full-page.png",
      fullPage: true,
    })

    // Check if we can navigate to new chat directly
    await page.goto("/chats/new")
    await page.waitForTimeout(2000)
    await page.screenshot({path: "/tmp/playwright-debug/new-chat-page.png"})

    // Check if search input exists
    const searchInput = page.getByPlaceholder("Search for users")
    const isSearchVisible = await searchInput.isVisible().catch(() => false)
    console.log("Search input visible:", isSearchVisible)
  })
})
