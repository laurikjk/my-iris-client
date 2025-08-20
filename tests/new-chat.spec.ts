import {test, expect} from "@playwright/test"
import {signUp} from "./auth.setup"

test.skip("can search for self and start a private chat via user search", async ({
  page,
}) => {
  // Sign up and get username
  const username = await signUp(page)

  // Navigate to chats via navbar
  await page.getByRole("link", {name: "Chats"}).click()
  await page.waitForLoadState("networkidle")

  // Wait for the New Chat text to be visible (it's inside the header)
  await expect(page.getByText("New Chat")).toBeVisible({timeout: 10000})

  // We're already on the new chat page at /chats
  // No need to click any link since /chats now shows NewChat by default

  // Wait for the search input to be visible (use first in case of duplicates)
  const searchInput = page.getByPlaceholder("Search for users").first()
  await expect(searchInput).toBeVisible()

  // Search for self by username - try partial match first
  await searchInput.fill("Test")
  await page.waitForTimeout(1500) // Wait for search results to update

  // Look for any button containing UserRow with our username
  // The button might have different aria-label depending on profile data
  const userButton = page
    .locator("button")
    .filter({has: page.getByText(username)})
    .first()

  try {
    await expect(userButton).toBeVisible({timeout: 5000})
  } catch (e) {
    // If not found, log what buttons are available for debugging
    const allButtons = await page.locator("button").allTextContents()
    console.error("All buttons found:", allButtons)

    // Also check if there's a message about no users with secure messaging
    const noUsersMessage = page.getByText(
      "followed or messaged users have enabled secure messaging"
    )
    if (await noUsersMessage.isVisible()) {
      console.error(
        "No users with secure messaging found - user might not have enabled it"
      )
    }
    throw e
  }
  await userButton.click()

  // Wait for navigation to chat view
  await expect(page).toHaveURL(/\/chats\/chat/, {timeout: 10000})

  // Wait a bit for the chat to fully load
  await page.waitForTimeout(1000)

  // Find the last (most likely visible) message input
  // Use last() since there are multiple and the visible one is likely the last one
  const messageInput = page.getByPlaceholder("Message").last()

  // Wait for it to be visible and fill it
  await expect(messageInput).toBeVisible({timeout: 5000})
  await messageInput.fill("Hello")
  await messageInput.press("Enter")

  // Verify message appears in chat - wait a bit for message to be processed
  await page.waitForTimeout(1000)

  // Look for the message text anywhere in the page
  // The message might be wrapped in various components
  await expect(page.getByText("Hello").first()).toBeVisible({timeout: 5000})
})
