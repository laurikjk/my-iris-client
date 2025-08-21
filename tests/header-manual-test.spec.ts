import {test} from "@playwright/test"

test.describe("Manual header auto-hide test", () => {
  test("Instructions for manual testing", async ({page}) => {
    console.log("\n=== MANUAL TEST INSTRUCTIONS ===")
    console.log("1. Set browser to mobile size (375x667)")
    console.log("2. Navigate to home page")
    console.log("3. Scroll down - header should hide")
    console.log("4. Click footer search button")
    console.log("5. In search, scroll down - header should hide")
    console.log("6. Click footer home button")
    console.log("7. Back in home, scroll down - header should hide")
    console.log("================================\n")

    // Set mobile viewport
    await page.setViewportSize({width: 375, height: 667})

    // Start at home
    await page.goto("http://localhost:5173/")
    await page.waitForTimeout(2000)

    // Take screenshot
    await page.screenshot({path: "/tmp/1-home-initial.png"})
    console.log("Screenshot saved: /tmp/1-home-initial.png")

    // Navigate to search
    const searchButton = await page.locator('footer a[href="/search"]').first()
    await searchButton.click()
    await page.waitForTimeout(2000)

    await page.screenshot({path: "/tmp/2-search-initial.png"})
    console.log("Screenshot saved: /tmp/2-search-initial.png")

    // Navigate back to home
    const homeButton = await page.locator('footer a[href="/"]').first()
    await homeButton.click()
    await page.waitForTimeout(2000)

    await page.screenshot({path: "/tmp/3-home-after-nav.png"})
    console.log("Screenshot saved: /tmp/3-home-after-nav.png")

    // Check if header exists and is visible
    const header = await page.locator("header:visible").first()
    const headerExists = (await header.count()) > 0
    console.log("Header exists after navigation:", headerExists)

    if (headerExists) {
      const transform = await header.evaluate(
        (el) => window.getComputedStyle(el).transform
      )
      console.log("Header transform after navigation:", transform)
    }

    // Try to find scrollable element
    const scrollable = await page.locator("[data-header-scroll-target]").first()
    const hasScrollable = (await scrollable.count()) > 0
    console.log("Has scrollable element:", hasScrollable)

    if (hasScrollable) {
      const scrollInfo = await scrollable.evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        canScroll: el.scrollHeight > el.clientHeight,
      }))
      console.log("Scrollable info:", scrollInfo)
    }

    console.log("\nPlease manually test scrolling behavior in the browser")
  })
})
