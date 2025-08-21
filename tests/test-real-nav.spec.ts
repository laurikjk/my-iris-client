import {test} from "@playwright/test"

test.describe("Real navigation test", () => {
  test("Test with real user navigation", async ({page}) => {
    // Set mobile viewport
    await page.setViewportSize({width: 375, height: 667})

    // Capture console logs
    page.on("console", (msg) => {
      if (msg.text().includes("[Header]")) {
        console.log("Browser:", msg.text())
      }
    })

    // Start at home
    await page.goto("http://localhost:5173/")
    await page.waitForTimeout(2000)

    console.log("\n1. Testing home page scroll...")
    const homeScrollable = await page.locator("[data-header-scroll-target]").first()
    if ((await homeScrollable.count()) > 0) {
      await homeScrollable.evaluate((el) => {
        console.log("[Test] Home - scrolling down")
        el.scrollTop = 200
      })
      await page.waitForTimeout(500)

      const homeHeader = await page.locator("header:visible").first()
      const homeTransform = await homeHeader.evaluate(
        (el) => window.getComputedStyle(el).transform
      )
      console.log("Home header after scroll:", homeTransform)
    }

    // Navigate to search using footer
    console.log("\n2. Navigating to search...")
    const searchButton = await page.locator('footer a[href="/search"]').first()
    await searchButton.click()
    await page.waitForTimeout(2000)

    console.log("3. Testing search page scroll...")
    const searchScrollable = await page.locator("[data-header-scroll-target]").first()
    if ((await searchScrollable.count()) > 0) {
      const canScroll = await searchScrollable.evaluate((el) => {
        const can = el.scrollHeight > el.clientHeight
        console.log(
          "[Test] Search - scrollHeight:",
          el.scrollHeight,
          "clientHeight:",
          el.clientHeight,
          "can scroll:",
          can
        )
        return can
      })

      if (canScroll) {
        await searchScrollable.evaluate((el) => {
          console.log("[Test] Search - scrolling down")
          el.scrollTop = 200
          el.dispatchEvent(new Event("scroll"))
        })
        await page.waitForTimeout(500)
      } else {
        console.log("Search not scrollable")
      }

      const searchHeader = await page.locator("header:visible").first()
      const searchTransform = await searchHeader.evaluate(
        (el) => window.getComputedStyle(el).transform
      )
      console.log("Search header after scroll:", searchTransform)
    }

    // Navigate back to home
    console.log("\n4. Navigating back to home...")
    const homeButton = await page.locator('footer a[href="/"]').first()
    await homeButton.click()
    await page.waitForTimeout(3000) // Give time for feed to load

    console.log("5. Testing home page scroll after navigation...")
    const homeScrollable2 = await page.locator("[data-header-scroll-target]").first()
    if ((await homeScrollable2.count()) > 0) {
      // Check if content is loaded
      const hasContent = await homeScrollable2.evaluate((el) => {
        const canScroll = el.scrollHeight > el.clientHeight
        console.log(
          "[Test] Home after nav - scrollHeight:",
          el.scrollHeight,
          "clientHeight:",
          el.clientHeight
        )
        return canScroll
      })

      if (hasContent) {
        await homeScrollable2.evaluate((el) => {
          console.log("[Test] Home after nav - scrolling down")
          el.scrollTop = 200
        })
        await page.waitForTimeout(500)

        const homeHeader2 = await page.locator("header:visible").first()
        const homeTransform2 = await homeHeader2.evaluate(
          (el) => window.getComputedStyle(el).transform
        )
        console.log("Home header after scroll (post-nav):", homeTransform2)
      } else {
        console.log("Home feed not loaded yet")
      }
    }
  })
})
