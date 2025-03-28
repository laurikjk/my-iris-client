import {test, expect} from "@playwright/test"
import {signUp} from "./auth.setup"

test("can open QR code on own profile", async ({page}) => {
  // Login first
  await signUp(page)

  // Click on user avatar in sidebar to go to own profile
  await page.getByTestId("sidebar-user-row").locator("img").first().click()

  // Click QR code button in profile header
  await page.getByRole("button", {name: "Show QR Code"}).click()

  // Verify QR code modal is visible
  await expect(page.getByRole("img", {name: "QR Code"})).toBeVisible()

  // Verify QR code data is visible and contains nostr:npub
  const qrData = page.getByText(/nostr:npub/)
  await expect(qrData).toBeVisible()
})
