import {test, expect} from "@playwright/test"

test("home page loads", async ({page}) => {
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await expect(page).toHaveTitle(/iris/)
})
