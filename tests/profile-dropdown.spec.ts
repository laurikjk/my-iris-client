import {test, expect} from "@playwright/test"
import {signUp} from "./auth.setup"

test.describe("Profile dropdown functionality", () => {
  test("dropdown button appears in header for other profiles and shows mute option", async ({
    page,
  }) => {
    // Sign up as a test user
    await signUp(page, "Test User")

    // Use a hardcoded npub to test profile functionality
    const testNpub = "npub1g53mukxnjkcmr94fhryzkqutdz2ukq4ks0gvy5af25rgmwsl4ngq43drvk"

    // Navigate to the other user's profile
    const searchInput = page.getByPlaceholder("Search")
    await searchInput.fill(testNpub)
    await searchInput.press("Enter")

    // Wait for profile page to load
    await expect(page.url()).not.toMatch(/localhost:5173\/?$/)

    // Check that the header is visible
    const header = page.locator("header").first()
    await expect(header).toBeVisible()

    // Look for the dropdown button in the header using test-id
    const dropdownButton = page.getByTestId("profile-dropdown-button")
    await expect(dropdownButton).toBeVisible({timeout: 10000})

    // Click the dropdown button to open the menu
    await dropdownButton.click()

    // Wait for dropdown to be visible
    const dropdown = page.locator(".dropdown-content").first()
    await expect(dropdown).toBeVisible({timeout: 5000})

    // Check that the dropdown contains "Mute" text
    await expect(dropdown).toContainText("Mute")
  })

  test("dropdown button does not appear for own profile", async ({page}) => {
    // Sign up as a test user
    const username = "Test User"
    await signUp(page, username)

    // Navigate to own profile
    await page.goto("/profile")

    // Wait for profile page to load
    await expect(page.url()).toContain("/profile")

    // Check that the header is visible
    const header = page.locator("header").first()
    await expect(header).toBeVisible()

    // Count dropdown buttons - should be different from other profiles
    const dropdownButtons = await page.locator("header button.btn-circle.btn-ghost").all()

    // Check none of them open a mute menu
    let hasMuteDropdown = false
    for (const button of dropdownButtons) {
      // Try clicking each button
      const isVisible = await button.isVisible()
      if (isVisible) {
        await button.click()
        await page.waitForTimeout(200)

        // Check if a dropdown with "Mute" appears
        const muteOption = page
          .locator(".dropdown-content:visible")
          .locator('text="Mute"')
        if (await muteOption.isVisible().catch(() => false)) {
          hasMuteDropdown = true
          break
        }
      }
    }

    // Should not have found a mute dropdown for own profile
    expect(hasMuteDropdown).toBe(false)
  })
})
