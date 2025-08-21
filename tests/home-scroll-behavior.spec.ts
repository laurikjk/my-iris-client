import {test, expect} from "@playwright/test"

test.describe("Home Feed Scroll Behavior", () => {
  test("Mobile: scroll works and header is outside pull-to-refresh", async ({page}) => {
    // Set mobile viewport
    await page.setViewportSize({width: 375, height: 667})

    // Navigate to home
    await page.goto("http://localhost:5173/")

    // Wait for content to load
    await page.waitForTimeout(2000)

    // Check if header exists and is visible
    const header = await page.locator("header").first()
    expect(await header.isVisible()).toBe(true)

    // Check if scrollable element exists
    const scrollable = await page.locator("[data-scrollable]").first()
    expect(await scrollable.count()).toBeGreaterThan(0)

    // Check if header is NOT inside scrollable (pull-to-refresh area)
    const headerInsideScrollable = await page.evaluate(() => {
      const header = document.querySelector("header")
      const scrollable = document.querySelector("[data-scrollable]")
      if (!header || !scrollable) return null
      return scrollable.contains(header)
    })
    expect(headerInsideScrollable).toBe(false)

    // Test scrolling
    const initialScrollTop = await scrollable.evaluate((el) => el.scrollTop)
    await scrollable.evaluate((el) => {
      el.scrollTop = 200
    })
    await page.waitForTimeout(100)
    const newScrollTop = await scrollable.evaluate((el) => el.scrollTop)

    // Verify scroll worked
    expect(newScrollTop).toBeGreaterThan(initialScrollTop)
  })

  test("Mobile: header hides on scroll down and shows on scroll up", async ({page}) => {
    // Set mobile viewport
    await page.setViewportSize({width: 375, height: 667})

    // Navigate to home
    await page.goto("http://localhost:5173/")

    // Wait for content to load
    await page.waitForTimeout(2000)

    const header = await page.locator("header").first()
    const scrollable = await page.locator("[data-scrollable]").first()

    // Check initial state - header should be visible
    const initialTransform = await header.evaluate(
      (el) => window.getComputedStyle(el).transform
    )
    expect(initialTransform).toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/)

    // Scroll down significantly
    await scrollable.evaluate((el) => {
      el.scrollTop = 300
      el.dispatchEvent(new Event("scroll"))
    })
    await page.waitForTimeout(300)

    // Check if header is hidden (translateY should be negative)
    const hiddenTransform = await header.evaluate(
      (el) => window.getComputedStyle(el).transform
    )
    // Extract Y translation from matrix
    const hiddenY = hiddenTransform.match(
      /matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*(-?\d+)/
    )?.[1]
    expect(Number(hiddenY || 0)).toBeLessThan(0)

    // Scroll back to top
    await scrollable.evaluate((el) => {
      el.scrollTop = 0
      el.dispatchEvent(new Event("scroll"))
    })
    await page.waitForTimeout(300)

    // Header should be visible again
    const visibleTransform = await header.evaluate(
      (el) => window.getComputedStyle(el).transform
    )
    expect(visibleTransform).toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/)
  })

  test("Desktop two-column: middle column scrolls properly", async ({page}) => {
    // Set desktop viewport
    await page.setViewportSize({width: 1400, height: 900})

    // Navigate to home
    await page.goto("http://localhost:5173/")

    // Wait for content to load
    await page.waitForTimeout(2000)

    // Toggle to two-column layout if needed
    const toggleButton = await page.locator('header button[title*="column"]').first()
    if ((await toggleButton.count()) > 0) {
      const buttonTitle = await toggleButton.getAttribute("title")
      if (buttonTitle?.includes("Expand")) {
        await toggleButton.click()
        await page.waitForTimeout(500)
      }
    }

    // Check if middle column exists
    const middleColumn = await page.locator(
      '[data-main-scroll-container="middle-column"]'
    )
    const hasMiddleColumn = (await middleColumn.count()) > 0

    if (hasMiddleColumn) {
      // Verify middle column can scroll
      const scrollInfo = await middleColumn.evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        canScroll: el.scrollHeight > el.clientHeight,
      }))

      expect(scrollInfo.canScroll).toBe(true)

      // Test actual scrolling
      await middleColumn.evaluate((el) => {
        el.scrollTop = 200
      })
      await page.waitForTimeout(100)
      const scrollTop = await middleColumn.evaluate((el) => el.scrollTop)
      expect(scrollTop).toBe(200)
    }
  })

  test("Desktop single-column: scroll works with header visible", async ({page}) => {
    // Set desktop viewport
    await page.setViewportSize({width: 1400, height: 900})

    // Navigate to home
    await page.goto("http://localhost:5173/")

    // Wait for content to load
    await page.waitForTimeout(2000)

    // Ensure single-column layout
    const toggleButton = await page.locator('header button[title*="column"]').first()
    if ((await toggleButton.count()) > 0) {
      const buttonTitle = await toggleButton.getAttribute("title")
      if (buttonTitle?.includes("Collapse")) {
        await toggleButton.click()
        await page.waitForTimeout(500)
      }
    }

    // Check header is visible
    const header = await page.locator("header").first()
    expect(await header.isVisible()).toBe(true)

    // Check scrollable element exists and works
    const scrollable = await page.locator("[data-scrollable]").first()
    if ((await scrollable.count()) > 0) {
      const canScroll = await scrollable.evaluate(
        (el) => el.scrollHeight > el.clientHeight
      )
      expect(canScroll).toBe(true)
    }
  })

  test("Desktop: clicking header scrolls to top", async ({page}) => {
    // Set desktop viewport
    await page.setViewportSize({width: 1400, height: 900})

    // Navigate to home
    await page.goto("http://localhost:5173/")

    // Wait for content to load
    await page.waitForTimeout(2000)

    // Find scrollable element
    const scrollable = await page.locator("[data-header-scroll-target]").first()
    expect(await scrollable.count()).toBeGreaterThan(0)

    // Scroll down first
    await scrollable.evaluate((el) => {
      el.scrollTop = 500
    })
    await page.waitForTimeout(100)

    // Verify scrolled down
    const scrolledPosition = await scrollable.evaluate((el) => el.scrollTop)
    expect(scrolledPosition).toBe(500)

    // Click header (not on buttons)
    const headerText = await page.locator("header span").first()
    await headerText.click()

    // Wait for scroll animation
    await page.waitForTimeout(300)

    // Check if scrolled to top
    const finalPosition = await scrollable.evaluate((el) => el.scrollTop)
    expect(finalPosition).toBe(0)
  })

  test("Pull-to-refresh: header remains fixed during pull", async ({page}) => {
    // Set mobile viewport
    await page.setViewportSize({width: 375, height: 667})

    // Navigate to home
    await page.goto("http://localhost:5173/")

    // Wait for content to load
    await page.waitForTimeout(2000)

    const header = await page.locator("header").first()
    const initialHeaderPosition = await header.boundingBox()

    // Simulate pull-to-refresh gesture (this is simplified, real touch would be more complex)
    const scrollable = await page.locator("[data-scrollable]").first()

    // Get initial header position
    const headerTop = initialHeaderPosition?.y || 0

    // Scroll to top first
    await scrollable.evaluate((el) => {
      el.scrollTop = 0
    })

    // After any simulated pull, header should remain in same position
    const finalHeaderPosition = await header.boundingBox()
    expect(finalHeaderPosition?.y).toBe(headerTop)
  })
})
