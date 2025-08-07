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

/**
 * Scroll the main content container to top
 */
export const scrollMainContentToTop = (): boolean => {
  const container = findMainScrollContainer()
  if (container) {
    container.scrollTo({top: 0, behavior: "instant"})
    return true
  }
  return false
}

/**
 * Check if the main content container is scrolled to top
 */
export const isMainContentAtTop = (): boolean => {
  const container = findMainScrollContainer()
  return !container || container.scrollTop === 0
}
