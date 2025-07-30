import {useRef, useCallback} from "react"

export type ScrollDirection = "none" | "horizontal" | "vertical"

interface UseScrollDirectionReturn {
  detectDirection: (deltaX: number, deltaY: number) => ScrollDirection
  getCurrentDirection: () => ScrollDirection
  reset: () => void
}

export function useScrollDirection(): UseScrollDirectionReturn {
  const scrollDirection = useRef<ScrollDirection>("none")

  const detectDirection = useCallback(
    (deltaX: number, deltaY: number): ScrollDirection => {
      // Only detect direction on first significant movement
      if (
        scrollDirection.current === "none" &&
        (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)
      ) {
        const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.5 // Bias towards horizontal
        scrollDirection.current = isHorizontal ? "horizontal" : "vertical"
      }
      return scrollDirection.current
    },
    []
  )

  const getCurrentDirection = useCallback(() => {
    return scrollDirection.current
  }, [])

  const reset = useCallback(() => {
    scrollDirection.current = "none"
  }, [])

  return {
    detectDirection,
    getCurrentDirection,
    reset,
  }
}
