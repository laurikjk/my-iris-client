import {test, expect} from "@playwright/test"

test.describe("Header auto-hide with client-side navigation", () => {
  test("Header auto-hides after clicking navigation buttons", async ({page}) => {
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

    // Try to scroll in home view first
    const homeScrollable = await page.locator("[data-header-scroll-target]").first()
    if ((await homeScrollable.count()) > 0) {
      const canScroll = await homeScrollable.evaluate(
        (el) => el.scrollHeight > el.clientHeight
      )

      if (canScroll) {
        await homeScrollable.evaluate((el) => {
          el.scrollTop = 200
          el.dispatchEvent(new Event("scroll"))
        })
        await page.waitForTimeout(300)

        const afterScrollHome = await header.evaluate(
          (el) => window.getComputedStyle(el).transform
        )
        console.log("Home after scroll:", afterScrollHome)
      }
    }

    // Click search button in footer
    const searchButton = await page.locator('footer a[href="/search"]').first()

    if ((await searchButton.count()) > 0) {
      // Footer is fixed position at bottom, just click it
      await searchButton.click()
      await page.waitForTimeout(2000)

      // Take screenshot to debug
      await page.screenshot({path: "/tmp/search-after-nav.png"})

      // Check how many headers exist
      const headerCount = await page.locator("header").count()
      console.log("Number of headers in search:", headerCount)

      // Get the visible header (might be a different one)
      const searchHeader = await page.locator("header:visible").first()
      const afterNavTransform = await searchHeader.evaluate(
        (el) => window.getComputedStyle(el).transform
      )
      console.log("Search after nav:", afterNavTransform)

      // Check if data-header-scroll-target exists
      const hasScrollTarget = await page.locator("[data-header-scroll-target]").count()
      console.log("Search has scroll target:", hasScrollTarget > 0)

      // Find scrollable element in search view
      const searchScrollable = await page.locator("[data-header-scroll-target]").first()

      if ((await searchScrollable.count()) > 0) {
        const canScroll = await searchScrollable.evaluate(
          (el) => el.scrollHeight > el.clientHeight
        )

        if (canScroll) {
          // Scroll down in search
          await searchScrollable.evaluate((el) => {
            el.scrollTop = 200
            el.dispatchEvent(new Event("scroll"))
          })
          await page.waitForTimeout(300)

          // Check if header hides
          const hiddenTransform = await searchHeader.evaluate(
            (el) => window.getComputedStyle(el).transform
          )

          // Extract Y translation
          const hiddenY = hiddenTransform.match(
            /matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*(-?\d+)/
          )?.[1]
          const isHidden = Number(hiddenY || 0) < 0

          console.log("Search after scroll:", hiddenTransform, "Hidden:", isHidden)
          expect(isHidden).toBeTruthy()
        } else {
          console.log("Search view: Not enough content to scroll")
        }
      }

      // Navigate back to home
      const homeButton = await page.locator('footer a[href="/"]').first()

      if ((await homeButton.count()) > 0) {
        await homeButton.click()
        await page.waitForTimeout(2000)

        // Header should be visible again after navigation
        const homeAfterReturn = await header.evaluate(
          (el) => window.getComputedStyle(el).transform
        )
        console.log("Home after return:", homeAfterReturn)

        // Check if header is reset to visible
        expect(homeAfterReturn).toBe("matrix(1, 0, 0, 1, 0, 0)")
      }
    } else {
      console.log("Could not find navigation buttons - skipping test")
    }
  })
})
