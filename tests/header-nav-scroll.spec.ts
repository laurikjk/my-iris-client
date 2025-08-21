import {test, expect} from "@playwright/test"

test.describe("Header auto-hide with navigation and scrolling", () => {
  test("Header hides after navigation and scrolling", async ({page}) => {
    // Set mobile viewport
    await page.setViewportSize({width: 375, height: 667})

    // Capture console logs
    page.on("console", (msg) => {
      if (msg.text().includes("[Header]") || msg.text().includes("[Test]")) {
        console.log("Browser console:", msg.text())
      }
    })

    // Start at home
    await page.goto("http://localhost:5173/")
    await page.waitForTimeout(2000)

    // Navigate to search with a query that will have results
    await page.goto("http://localhost:5173/search/nostr")
    await page.waitForTimeout(3000) // Give time for results to load

    // Get the visible header in search view
    const searchHeader = await page.locator("header:visible").first()

    // Check initial state
    const initialTransform = await searchHeader.evaluate(
      (el) => window.getComputedStyle(el).transform
    )
    console.log("Search initial:", initialTransform)
    expect(initialTransform).toBe("matrix(1, 0, 0, 1, 0, 0)")

    // Find scrollable element
    const scrollable = await page.locator("[data-header-scroll-target]").first()
    const hasScrollable = (await scrollable.count()) > 0

    if (hasScrollable) {
      // Check if content is scrollable
      const canScroll = await scrollable.evaluate(
        (el) => el.scrollHeight > el.clientHeight
      )

      if (canScroll) {
        // Scroll down
        await scrollable.evaluate((el) => {
          el.scrollTop = 200
          el.dispatchEvent(new Event("scroll"))
        })
        await page.waitForTimeout(500)

        // Check if header hides
        const hiddenTransform = await searchHeader.evaluate(
          (el) => window.getComputedStyle(el).transform
        )

        const hiddenY = hiddenTransform.match(
          /matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*(-?\d+)/
        )?.[1]
        const isHidden = Number(hiddenY || 0) < 0

        console.log("Search after scroll:", hiddenTransform, "Hidden:", isHidden)
        expect(isHidden).toBeTruthy()

        // Navigate back to home using footer
        const homeButton = await page.locator('footer a[href="/"]').first()
        await homeButton.click()

        // Wait for home feed to load
        await page.waitForTimeout(3000)
        await page.waitForSelector("article", {timeout: 5000}).catch(() => {
          console.log("No articles found in home feed")
        })

        // Get the header in home view
        const homeHeader = await page.locator("header:visible").first()

        // Header should be visible again
        const homeTransform = await homeHeader.evaluate(
          (el) => window.getComputedStyle(el).transform
        )
        console.log("Home after return:", homeTransform)
        expect(homeTransform).toBe("matrix(1, 0, 0, 1, 0, 0)")

        // Scroll in home to verify it still works
        const homeScrollable = await page.locator("[data-header-scroll-target]").first()

        // Check if home is actually scrollable
        const homeCanScroll = await homeScrollable.evaluate((el) => {
          console.log(
            "[Test] Home scrollHeight:",
            el.scrollHeight,
            "clientHeight:",
            el.clientHeight
          )
          return el.scrollHeight > el.clientHeight
        })

        if (!homeCanScroll) {
          console.log("Home not scrollable after navigation - not enough content")
          return
        }

        await homeScrollable.evaluate((el) => {
          console.log("[Test] Setting scrollTop to 200")
          el.scrollTop = 200
          el.dispatchEvent(new Event("scroll"))
          console.log("[Test] After setting, scrollTop is:", el.scrollTop)
        })
        await page.waitForTimeout(500)

        const homeHiddenTransform = await homeHeader.evaluate(
          (el) => window.getComputedStyle(el).transform
        )

        const homeHiddenY = homeHiddenTransform.match(
          /matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*(-?\d+)/
        )?.[1]
        const homeIsHidden = Number(homeHiddenY || 0) < 0

        console.log("Home after scroll:", homeHiddenTransform, "Hidden:", homeIsHidden)
        expect(homeIsHidden).toBeTruthy()
      } else {
        console.log("Search results not scrollable - not enough content")
      }
    }
  })
})
