import {expect} from "@playwright/test"

async function signUp(page, username = "Test User") {
  // Start from the home page
  await page.goto("/")

  // Wait for any signup button to be visible and click it
  const signUpButtons = page.locator(".signup-btn")
  const visibleButton = signUpButtons.filter({hasText: "Sign up"}).first()
  await visibleButton.waitFor({state: "visible", timeout: 10000})
  await visibleButton.click()

  // Wait for the signup dialog to appear
  await expect(page.getByRole("heading", {name: "Sign up"})).toBeVisible()

  // Enter a name
  const nameInput = page.getByPlaceholder("What's your name?")
  await nameInput.fill(username)

  // Click the Go button
  const goButton = page.getByRole("button", {name: "Go"})
  await goButton.click()

  // Wait for signup to complete
  await expect(page.getByRole("heading", {name: "Sign up"})).not.toBeVisible()
  await expect(page.locator("#main-content").getByTestId("new-post-button")).toBeVisible()
  // Check that username appears in the sidebar (most reliable location)
  await expect(page.getByTestId("sidebar-user-row").getByText(username)).toBeVisible()

  // Get the generated private key
  const privateKey = await page.evaluate(() => {
    const userStore = localStorage.getItem("user-store")
    if (!userStore) return null
    const parsed = JSON.parse(userStore)
    return parsed?.state?.privateKey || null
  })

  return {username, privateKey}
}

async function signIn(page, privateKey: string) {
  await page.goto("/")

  // Click "Sign up" button to open dialog
  await page.getByRole("button", {name: "Sign up"}).click()

  // Wait for signup dialog to appear
  await expect(page.getByRole("heading", {name: "Sign up"})).toBeVisible()

  // Click "Already have an account?" to switch to sign in
  await page.getByText("Already have an account?").click()

  // Wait for sign in dialog
  await expect(page.getByRole("heading", {name: "Sign in"})).toBeVisible({timeout: 10000})

  // Paste the private key - should auto-login
  const keyInput = page.getByPlaceholder(/paste.*key/i)
  await keyInput.fill(privateKey)

  // Wait for sign in to complete (dialog closes automatically)
  await expect(page.getByRole("heading", {name: "Sign in"})).not.toBeVisible({
    timeout: 10000,
  })
  await expect(page.locator("#main-content").getByTestId("new-post-button")).toBeVisible({
    timeout: 10000,
  })
}

export {signUp, signIn}
