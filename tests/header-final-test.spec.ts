import {test, expect} from "@playwright/test"

test.describe("Final header auto-hide test", () => {
  test("Header auto-hide after navigation", async ({page}) => {
    // Set mobile viewport
    await page.setViewportSize({width: 375, height: 667})

    // Start at home
    await page.goto("http://localhost:5173/")
    await page.waitForTimeout(3000) // Wait for initial load

    // Navigate to search
    const searchButton = await page.locator('footer a[href="/search"]').first()
    await searchButton.click()
    await page.waitForTimeout(2000)

    // Navigate back to home
    const homeButton = await page.locator('footer a[href="/"]').first()
    await homeButton.click()
    await page.waitForTimeout(3000) // Give time for everything to settle

    // Get the visible header
    const header = await page.locator("header:visible").first()

    // Check initial state
    const initialTransform = await header.evaluate(
      (el) => window.getComputedStyle(el).transform
    )
    console.log("Home after nav - initial:", initialTransform)

    // Find scrollable element
    const scrollable = await page.locator("[data-header-scroll-target]").first()

    // Verify it can scroll
    const canScroll = await scrollable.evaluate((el) => {
      const can = el.scrollHeight > el.clientHeight
      console.log(
        "ScrollHeight:",
        el.scrollHeight,
        "ClientHeight:",
        el.clientHeight,
        "Can scroll:",
        can
      )
      return can
    })

    if (!canScroll) {
      throw new Error("Home feed not scrollable")
    }

    // Now try to scroll using different methods
    console.log("Method 1: Setting scrollTop directly")
    await scrollable.evaluate((el) => {
      el.scrollTop = 200
    })
    await page.waitForTimeout(100)

    // Check transform after direct scroll
    const afterDirectScroll = await header.evaluate(
      (el) => window.getComputedStyle(el).transform
    )
    console.log("After direct scroll:", afterDirectScroll)

    // Reset scroll
    await scrollable.evaluate((el) => {
      el.scrollTop = 0
    })
    await page.waitForTimeout(500)

    // Method 2: Dispatch scroll event
    console.log("Method 2: Dispatching scroll event")
    await scrollable.evaluate((el) => {
      el.scrollTop = 200
      el.dispatchEvent(new Event("scroll", {bubbles: true}))
    })
    await page.waitForTimeout(500)

    // Check transform after event dispatch
    const afterEventScroll = await header.evaluate(
      (el) => window.getComputedStyle(el).transform
    )
    console.log("After event scroll:", afterEventScroll)

    // Reset scroll
    await scrollable.evaluate((el) => {
      el.scrollTop = 0
    })
    await page.waitForTimeout(500)

    // Method 3: Use mouse wheel
    console.log("Method 3: Using mouse wheel")
    await scrollable.hover()
    await page.mouse.wheel(0, 200)
    await page.waitForTimeout(500)

    // Check transform after wheel scroll
    const afterWheelScroll = await header.evaluate(
      (el) => window.getComputedStyle(el).transform
    )
    console.log("After wheel scroll:", afterWheelScroll)

    // Check final scroll position
    const finalScrollTop = await scrollable.evaluate((el) => el.scrollTop)
    console.log("Final scrollTop:", finalScrollTop)

    // At least one method should hide the header
    const transforms = [afterDirectScroll, afterEventScroll, afterWheelScroll]
    const anyHidden = transforms.some((transform) => {
      const match = transform.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*(-?\d+)/)
      const y = Number(match?.[1] || 0)
      return y < 0
    })

    expect(anyHidden).toBeTruthy()
  })
})
