import {test, expect} from "@playwright/test"
import {signUp} from "./auth.setup"

test("can view trending content", async ({page}) => {
  await signUp(page)

  await page.goto("/")

  await page.waitForSelector("#main-content", {state: "visible"})

  await expect(page.getByRole("heading", {name: "Popular"})).toBeVisible({
    timeout: 10000,
  })
})
