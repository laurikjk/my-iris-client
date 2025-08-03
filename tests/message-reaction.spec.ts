import {test, expect} from "@playwright/test"
import {signUp} from "./auth.setup"

async function setupChatWithSelf(page, username) {
  await page.getByRole("link", {name: "Chats"}).click()
  await page.waitForLoadState("networkidle")

  // Wait for either header text or link text
  await expect(
    page
      .getByRole("link", {name: /New Chat/})
      .or(page.locator("header").getByText("New Chat"))
  ).toBeVisible({timeout: 10000})

  // Click the New Chat link to go to /chats/new
  await page.getByRole("link", {name: /New Chat/}).click()
  await expect(page).toHaveURL(/\/chats\/new/)

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

  await page.getByTestId("reaction-button").click()
  await page.getByRole("button", {name: "👍"}).first().click()

  // Wait for reaction to be sent and displayed
  await page.waitForTimeout(2000)

  // Check if the reaction appears on the message
  // Reactions might appear in different ways depending on the UI
  await expect(page.getByText("👍").nth(1)).toBeVisible({timeout: 5000})
})
