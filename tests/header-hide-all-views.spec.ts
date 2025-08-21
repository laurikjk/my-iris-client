import {test, expect} from "@playwright/test"

test.describe("Header auto-hide works across all mobile views", () => {
  const testHeaderScroll = async (page, viewName: string) => {
    // Find scrollable element with data-header-scroll-target
    const scrollable = await page.locator("[data-header-scroll-target]").first()
    const hasScrollable = (await scrollable.count()) > 0

    if (!hasScrollable) {
      console.log(
        `${viewName}: No scrollable element with data-header-scroll-target found`
      )
      return false
    }

    // Get header element
    const header = await page.locator("header").first()
    const hasHeader = (await header.count()) > 0

    if (!hasHeader) {
      console.log(`${viewName}: No header found`)
      return false
    }

    // Check if element can scroll
    const canScroll = await scrollable.evaluate((el) => el.scrollHeight > el.clientHeight)

    if (!canScroll) {
      console.log(`${viewName}: Content not scrollable (not enough content)`)
      return true // Not a failure, just not enough content
    }

    // Check initial state
    const initialTransform = await header.evaluate(
      (el) => window.getComputedStyle(el).transform
    )

    // Scroll down
    await scrollable.evaluate((el) => {
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

    console.log(
      `${viewName}: Initial: ${initialTransform}, After scroll: ${hiddenTransform}, Hidden: ${isHidden}`
    )
    return isHidden
  }

  test("Profile view", async ({page}) => {
    await page.setViewportSize({width: 375, height: 667})
    await page.goto(
      "http://localhost:5173/npub1az9xj85cmxv8e9j9y80lvqp97crsqdu2fpu3srwthd99qfu9qsgstam8y8"
    )
    await page.waitForTimeout(2000)

    const works = await testHeaderScroll(page, "Profile")
    expect(works).toBeTruthy()
  })

  test("Thread view", async ({page}) => {
    await page.setViewportSize({width: 375, height: 667})
    await page.goto("http://localhost:5173/")
    await page.waitForTimeout(2000)

    // Click on first post to go to thread
    const firstPost = await page.locator("article").first()
    if ((await firstPost.count()) > 0) {
      await firstPost.click()
      await page.waitForTimeout(2000)

      const works = await testHeaderScroll(page, "Thread")
      expect(works).toBeTruthy()
    }
  })

  test("Notifications view", async ({page}) => {
    await page.setViewportSize({width: 375, height: 667})
    await page.goto("http://localhost:5173/notifications")
    await page.waitForTimeout(2000)

    const works = await testHeaderScroll(page, "Notifications")
    expect(works).toBeTruthy()
  })

  test("Search view", async ({page}) => {
    await page.setViewportSize({width: 375, height: 667})
    await page.goto("http://localhost:5173/search")
    await page.waitForTimeout(2000)

    const works = await testHeaderScroll(page, "Search")
    expect(works).toBeTruthy()
  })

  test("Settings view", async ({page}) => {
    await page.setViewportSize({width: 375, height: 667})
    await page.goto("http://localhost:5173/settings")
    await page.waitForTimeout(2000)

    const works = await testHeaderScroll(page, "Settings")
    expect(works).toBeTruthy()
  })
})
