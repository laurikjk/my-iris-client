import {test} from "@playwright/test"
import {signUp} from "./auth.setup"

test("for you feed shows posts after multiple refreshes", async ({page}) => {
  test.setTimeout(180000)

  const targetNpub = "npub1g53mukxnjkcmr94fhryzkqutdz2ukq4ks0gvy5af25rgmwsl4ngq43drvk"
  const logs: string[] = []

  page.on("console", (msg) => {
    const text = msg.text()
    logs.push(text)
    // Log messages that contain our debug markers
    if (
      text.includes("[") &&
      (text.includes("Subscription") || text.includes("Fetcher"))
    ) {
      console.log(text)
    }
  })

  // Login with the target user (read-only)
  console.log("=== Setting up target user ===")
  const authData = await signUp(page, targetNpub)
  console.log("Auth data:", {
    hasPrivateKey: !!authData.privateKey,
    publicKey: authData.publicKey?.slice(0, 16) + "...",
  })

  // Check localStorage to see what's actually stored
  const storedData = await page.evaluate(() => {
    const userStore = localStorage.getItem("user-store")
    if (!userStore) return null
    const parsed = JSON.parse(userStore)
    return {
      publicKey: parsed?.state?.publicKey,
      nip07Login: parsed?.state?.nip07Login,
      privateKey: !!parsed?.state?.privateKey,
    }
  })
  console.log("Stored data:", storedData)

  // Stay on the same page (signup already left us on home) - just wait for feed to load
  console.log("\n=== PHASE 1: Initial Load ===")

  // Check localStorage right after signup
  const afterSignupData = await page.evaluate(() => {
    const userStore = localStorage.getItem("user-store")
    if (!userStore) return null
    const parsed = JSON.parse(userStore)
    return {
      publicKey: parsed?.state?.publicKey,
      nip07Login: parsed?.state?.nip07Login,
    }
  })
  console.log("After signup localStorage:", afterSignupData)

  // Run up to 10 refresh cycles, fail immediately on first failure
  for (let cycle = 1; cycle <= 10; cycle++) {
    console.log(`\n=== CYCLE ${cycle} ===`)

    // Wait for feed to load/stabilize
    await page.waitForTimeout(6000)

    // Check if "No posts found for you" message appears
    const noPostsLocator = page.locator("text=No posts found for you")
    const hasNoPosts = (await noPostsLocator.count()) > 0

    if (hasNoPosts) {
      console.log(`Cycle ${cycle}: FAILED - Shows 'No posts found for you'`)
      throw new Error(`Feed failed to load on cycle ${cycle}`)
    }

    console.log(`Cycle ${cycle}: SUCCESS - Posts visible`)

    if (cycle < 10) {
      // Refresh page for next cycle
      console.log(`Refreshing page for cycle ${cycle + 1}...`)
      await page.reload()
      await page.waitForLoadState("networkidle")
    }
  }

  console.log("\n=== ALL CYCLES PASSED ===")
})
