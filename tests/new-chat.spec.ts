import {test, expect} from "@playwright/test"
import {signUp} from "./auth.setup"

test("can search for self and start a private chat via user search", async ({page}) => {
  // Sign up and get username
  const username = await signUp(page)

  // Navigate to chats via navbar
  await page.getByRole("link", {name: "Chats"}).click()
  await expect(page.getByRole("banner").getByText("New Chat")).toBeVisible()

  // Search for self by username
  const searchInput = page.getByPlaceholder("Search for users")
  await searchInput.fill(username)
  await page.waitForTimeout(1000) // Wait for search results to update

  // Click on self in search results
  const selfButton = page.getByRole("button", {name: username})
  await selfButton.click()

  // Wait for navigation to chat view
  await expect(page).toHaveURL(/\/chats\/chat/, {timeout: 10000})

  // Verify we can send a message
  const messageInput = page.getByPlaceholder("Message")
  await messageInput.fill("Hello")
  await messageInput.press("Enter")

  // Verify message appears in chat
  await expect(page.getByRole("paragraph").filter({hasText: "Hello"})).toBeVisible()
})
