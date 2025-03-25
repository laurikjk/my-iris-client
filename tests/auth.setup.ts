import {expect} from "@playwright/test"

async function signUp(page, username = "Test User") {
  // Start from the home page
  await page.goto("/")

  // Wait for the app to load
  await page.waitForLoadState("networkidle")

  // Click the sign up button in the nav sidebar
  const signUpButton = page
    .getByRole("button")
    .filter({has: page.locator("svg.remixicon.w-5.h-5")})
  await signUpButton.click()

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
  await expect(page.getByText(username, {exact: true})).toBeVisible()
}

export {signUp}
