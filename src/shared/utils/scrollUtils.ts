/**
 * Find the main content scroll container based on current layout
 * Uses data attributes to identify main scroll containers
 */
export const findMainScrollContainer = (): HTMLElement | null => {
  // Look for containers marked with data-main-scroll-container attribute
  const containers = document.querySelectorAll("[data-main-scroll-container]")

  // Find the first visible container
  for (const container of Array.from(containers)) {
    const el = container as HTMLElement
    if (el.offsetParent !== null) {
      // Check if visible
      return el
    }
  }

  return null
}
