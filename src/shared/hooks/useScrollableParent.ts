import {useEffect, useRef, RefObject} from "react"

/**
 * Hook to find and track the scrollable parent of an element
 * @param elementRef - Reference to the element whose scrollable parent we want to find
 * @returns Reference to the scrollable parent element (or null if none found)
 */
export function useScrollableParent(elementRef: RefObject<HTMLElement | null>) {
  const scrollContainerRef = useRef<HTMLElement | null>(null)

  const findScrollableParent = (element: HTMLElement | null): HTMLElement | null => {
    let parent = element?.parentElement
    while (parent) {
      const style = window.getComputedStyle(parent)
      if (
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        parent.scrollHeight > parent.clientHeight
      ) {
        return parent
      }
      parent = parent.parentElement
    }
    return null
  }

  useEffect(() => {
    // Find and cache the scrollable container
    scrollContainerRef.current = findScrollableParent(elementRef.current)
  }, [elementRef])

  return {
    scrollContainer: scrollContainerRef.current,
    findScrollableParent,
  }
}
