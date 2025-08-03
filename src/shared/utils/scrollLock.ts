let lockCount = 0
let originalBodyOverflow = ""
let originalBodyPosition = ""
let originalBodyTop = ""
let originalBodyWidth = ""
let originalBodyTouchAction = ""
let scrollY = 0

export function lockScroll(options: {touchAction?: string} = {}): () => void {
  if (lockCount === 0) {
    // Store current scroll position
    scrollY = window.scrollY

    // Store original styles
    originalBodyOverflow = document.body.style.overflow
    originalBodyPosition = document.body.style.position
    originalBodyTop = document.body.style.top
    originalBodyWidth = document.body.style.width
    originalBodyTouchAction = document.body.style.touchAction

    // Apply styles to lock scroll
    document.body.style.overflow = "hidden"
    document.body.style.touchAction = options.touchAction || "none"

    // iOS Safari specific fix: use position fixed
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      document.body.style.position = "fixed"
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = "100%"
    }
  }

  lockCount++

  return () => unlockScroll()
}

export function unlockScroll(): void {
  if (lockCount > 0) {
    lockCount--

    if (lockCount === 0) {
      // Restore original styles
      document.body.style.overflow = originalBodyOverflow
      document.body.style.position = originalBodyPosition
      document.body.style.top = originalBodyTop
      document.body.style.width = originalBodyWidth
      document.body.style.touchAction = originalBodyTouchAction

      // Restore scroll position if we used position fixed
      if (originalBodyPosition !== "fixed" && document.body.style.position === "") {
        window.scrollTo(0, scrollY)
      }
    }
  }
}
