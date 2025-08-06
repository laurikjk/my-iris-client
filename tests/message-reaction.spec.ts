import {test, expect} from "@playwright/test"
import {signUp} from "./auth.setup"

async function setupChatWithSelf(page, username) {
  await page.getByRole("link", {name: "Chats"}).click()
  await page.waitForLoadState("networkidle")

  // Wait for the New Chat header to be visible
  await expect(page.locator("header").getByText("New Chat")).toBeVisible({timeout: 10000})

  // We're already on the new chat page at /chats
  // No need to click any link since /chats now shows NewChat by default

  const searchInput = page.getByPlaceholder("Search for users")
  await searchInput.fill(username)
  await page.waitForTimeout(1000)
  const selfButton = page.getByRole("button", {name: username})
  await selfButton.click()
  await expect(page).toHaveURL(/\/chats\/chat/, {timeout: 10000})
}

test("user can react to a chat message", async ({page}) => {
  const username = await signUp(page)
  await setupChatWithSelf(page, username)

  const messageInput = page.getByPlaceholder("Message")
  const text = "Reaction test"
  await messageInput.fill(text)
  await messageInput.press("Enter")
  await expect(page.locator(".whitespace-pre-wrap").getByText(text)).toBeVisible()

  // Give the message time to be fully processed
  await page.waitForTimeout(1000)

  await page.getByTestId("reaction-button").first().click()
  await page.getByRole("button", {name: "👍"}).first().click()

  // Wait for reaction to be sent and displayed
  await page.waitForTimeout(2000)

  // Check if the reaction appears on the message
  // Look for reaction elements that contain the thumbs up
  const messageReactions = page.locator("div").filter({hasText: /^👍$/})
  const count = await messageReactions.count()
  console.log(`Found ${count} reaction elements with 👍`)
  expect(count).toBeGreaterThanOrEqual(1)
})
