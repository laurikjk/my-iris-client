export const isTauri = () => typeof window !== "undefined" && window.__TAURI__

export const openExternalLink = async (url: string) => {
  if (isTauri()) {
    try {
      const {openUrl} = await import("@tauri-apps/plugin-opener")
      console.log("Opening external URL in Tauri:", url)
      await openUrl(url)
      console.log("Successfully opened URL")
    } catch (error) {
      console.error("Failed to open URL in Tauri:", error)
      // Fallback to window.open
      window.open(url, "_blank")
    }
  } else {
    window.open(url, "_blank")
  }
}

export const formatAmount = (n: number, maxSignificantDigits = 4) => {
  if (n < 1000) return n.toString()

  let value: number
  let suffix: string

  if (n < 1000000) {
    value = n / 1000
    suffix = "K"
  } else {
    value = n / 1000000
    suffix = "M"
  }

  // Round to max significant digits
  const rounded = Number(value.toPrecision(Math.min(maxSignificantDigits, 4)))

  // Format with appropriate decimal places
  let formatted: string
  if (rounded >= 100) {
    formatted = Math.round(rounded).toString()
  } else if (rounded >= 10) {
    formatted = rounded.toFixed(1).replace(/\.0$/, "")
  } else {
    formatted = rounded.toFixed(2).replace(/\.00$/, "")
  }

  return formatted + suffix
}
