import {RefObject, MouseEvent} from "react"

interface UseHeaderClickOptions {
  headerRef: RefObject<HTMLDivElement | null>
  scrollContainer: Element | null
  findScrollableParent: (element: HTMLElement | null) => Element | null
  scrollDown: boolean
}

export const useHeaderClick = ({
  headerRef,
  scrollContainer,
  findScrollableParent,
  scrollDown,
}: UseHeaderClickOptions) => {
  const handleHeaderClick = (e: MouseEvent) => {
    // Don't scroll if clicking on a button or link
    if (
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest("a")
    )
      return

    // Find scroll target within the same page context
    let pageRoot = headerRef.current?.parentElement
    let scrollableParent: HTMLElement | null = null

    while (pageRoot) {
      const target = pageRoot.querySelector(
        "[data-header-scroll-target]"
      ) as HTMLElement | null
      if (target) {
        scrollableParent = target
        break
      }
      pageRoot = pageRoot.parentElement
    }

    // If not found, try to find scrollable parent (works for nested headers)
    if (!scrollableParent) {
      const foundParent =
        scrollContainer || findScrollableParent(headerRef.current) || null
      scrollableParent = foundParent as HTMLElement | null
    }

    // If not found, look for the outlet column (for profile/thread pages where header is outside)
    if (!scrollableParent) {
      // Find the outlet column - it's the overflow-y-auto element that's not the sidebar
      const scrollableElements = document.querySelectorAll(".overflow-y-auto")
      for (const element of Array.from(scrollableElements)) {
        const htmlElement = element as HTMLElement
        // Skip sidebar and right column
        if (
          !htmlElement.classList.contains("lg:block") &&
          !htmlElement.classList.contains("xl:block") &&
          htmlElement.scrollHeight > htmlElement.clientHeight
        ) {
          scrollableParent = htmlElement
          break
        }
      }
    }

    if (scrollableParent) {
      scrollableParent.scrollTo({
        top: scrollDown ? scrollableParent.scrollHeight : 0,
        behavior: "instant",
      })
    } else {
      // Fallback to window scroll if no scrollable parent found
      window.scrollTo({
        top: scrollDown ? document.body.scrollHeight : 0,
        behavior: "instant",
      })
    }
  }

  return handleHeaderClick
}
