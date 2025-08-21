import {test, expect} from "@playwright/test"

test.describe("Header auto-hide after navigation", () => {
  test("Header auto-hides after navigating between views", async ({page}) => {
    // Set mobile viewport
    await page.setViewportSize({width: 375, height: 667})

    // Start at home
    await page.goto("http://localhost:5173/")
    await page.waitForTimeout(2000)

    // Verify header is visible initially
    const header = await page.locator("header").first()
    const initialTransform = await header.evaluate(
      (el) => window.getComputedStyle(el).transform
    )
    console.log("Home initial:", initialTransform)

    // Navigate to search directly via URL
    await page.goto("http://localhost:5173/search")
    await page.waitForTimeout(2000)

    // Check if header resets to visible after navigation
    const afterNavTransform = await header.evaluate(
      (el) => window.getComputedStyle(el).transform
    )
    console.log("Search after nav:", afterNavTransform)

    // Find scrollable element in search view
    const searchScrollable = await page.locator("[data-header-scroll-target]").first()
    const hasScrollable = (await searchScrollable.count()) > 0

    if (!hasScrollable) {
      throw new Error("No scrollable element found in search view")
    }

    // Check if content is scrollable
    const canScroll = await searchScrollable.evaluate(
      (el) => el.scrollHeight > el.clientHeight
    )

    if (!canScroll) {
      console.log("Search view: Not enough content to scroll")
      // Navigate to a view with more content
      await page.goto("http://localhost:5173/")
      await page.waitForTimeout(2000)

      const homeScrollable = await page.locator("[data-header-scroll-target]").first()

      // Scroll down in home
      await homeScrollable.evaluate((el) => {
        el.scrollTop = 200
        el.dispatchEvent(new Event("scroll"))
      })
      await page.waitForTimeout(300)

      const hiddenInHome = await header.evaluate(
        (el) => window.getComputedStyle(el).transform
      )

      console.log("Home after scroll:", hiddenInHome)

      // Navigate back to search
      await page.goto("http://localhost:5173/search")
      await page.waitForTimeout(2000)

      // Header should be visible again after navigation
      const searchAfterReturn = await header.evaluate(
        (el) => window.getComputedStyle(el).transform
      )
      console.log("Search after return:", searchAfterReturn)

      // Check if header is reset to visible
      expect(searchAfterReturn).toBe("matrix(1, 0, 0, 1, 0, 0)")
    } else {
      // Scroll down in search
      await searchScrollable.evaluate((el) => {
        el.scrollTop = 200
        el.dispatchEvent(new Event("scroll"))
      })
      await page.waitForTimeout(300)

      // Check if header hides
      const hiddenTransform = await header.evaluate(
        (el) => window.getComputedStyle(el).transform
      )

      // Extract Y translation
      const hiddenY = hiddenTransform.match(
        /matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*(-?\d+)/
      )?.[1]
      const isHidden = Number(hiddenY || 0) < 0

      console.log("Search after scroll:", hiddenTransform, "Hidden:", isHidden)
      expect(isHidden).toBeTruthy()
    }
  })
})
