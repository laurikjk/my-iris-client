let lockCount = 0
let originalBodyOverflow = ""
let originalBodyTouchAction = ""

export function lockScroll(options: {touchAction?: string} = {}): () => void {
  if (lockCount === 0) {
    originalBodyOverflow = document.body.style.overflow
    originalBodyTouchAction = document.body.style.touchAction

    document.body.style.overflow = "hidden"
    document.body.style.touchAction = options.touchAction || "none"
  }

  lockCount++

  return () => unlockScroll()
}

export function unlockScroll(): void {
  if (lockCount > 0) {
    lockCount--

    if (lockCount === 0) {
      document.body.style.overflow = originalBodyOverflow
      document.body.style.touchAction = originalBodyTouchAction
    }
  }
}
