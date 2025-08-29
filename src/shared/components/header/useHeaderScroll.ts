import {useEffect, useRef, RefObject} from "react"
import {MOBILE_BREAKPOINT} from "@/shared/components/user/const"
import {useScrollableParent} from "@/shared/hooks/useScrollableParent"

interface UseHeaderScrollOptions {
  slideUp: boolean
  headerRef: RefObject<HTMLDivElement | null>
  contentRef: RefObject<HTMLDivElement | null>
  pathname: string
}

export const useHeaderScroll = ({
  slideUp,
  headerRef,
  contentRef,
  pathname,
}: UseHeaderScrollOptions) => {
  const lastScrollY = useRef(0)
  const scrollElementRef = useRef<Element | Window | null>(null)
  const {findScrollableParent} = useScrollableParent(headerRef)

  // Initialize header transform on mount and navigation
  useEffect(() => {
    if (headerRef.current && slideUp) {
      headerRef.current.style.transform = "translateY(0px)"

      // Initialize logo and feed name opacity for home page (mobile only)
      if (pathname === "/" && window.innerWidth < MOBILE_BREAKPOINT) {
        const logoElement = headerRef.current.querySelector(
          "[data-header-logo]"
        ) as HTMLElement
        const feedNameElement = headerRef.current.querySelector(
          "[data-header-feed-name]"
        ) as HTMLElement
        if (logoElement && feedNameElement) {
          // Initially at top, show logo
          logoElement.style.opacity = "1"
          feedNameElement.style.opacity = "0"
        }
      } else if (contentRef.current) {
        contentRef.current.style.opacity = "1"
      }
    }
  }, [slideUp, pathname, headerRef, contentRef])

  useEffect(() => {
    // Only enable slideUp on mobile
    if (!slideUp || window.innerWidth >= MOBILE_BREAKPOINT) return

    // Check if this is a main page header (not inside a feed item)
    const isInFeedItem = headerRef.current?.closest(
      '.feed-item, [class*="FeedItem"], .note-content'
    )
    if (isInFeedItem) {
      return
    }

    const HEADER_HEIGHT = 80
    const MIN_TRANSLATE_Y = -HEADER_HEIGHT
    const MAX_TRANSLATE_Y = 0
    const OPACITY_MIN_POINT = 30
    const SCROLL_THRESHOLD = 10

    const handleScroll = (e?: Event) => {
      // Only handle scroll on mobile
      if (window.innerWidth >= MOBILE_BREAKPOINT) return

      // Verify the header still exists in DOM
      if (!headerRef.current) return

      const currentScrollY = e ? (e.target as HTMLElement).scrollTop : window.scrollY
      let newTranslateY = 0

      const currentTranslateY = parseFloat(
        headerRef.current?.style.transform
          .replace("translateY(", "")
          .replace("px)", "") || "0"
      )

      if (currentScrollY > lastScrollY.current && currentScrollY > SCROLL_THRESHOLD) {
        // Scrolling down - hide header
        newTranslateY = Math.max(
          MIN_TRANSLATE_Y,
          currentTranslateY - (currentScrollY - lastScrollY.current)
        )
      } else if (currentScrollY < lastScrollY.current) {
        // Scrolling up - show header
        newTranslateY = Math.min(
          MAX_TRANSLATE_Y,
          currentTranslateY + (lastScrollY.current - currentScrollY)
        )
      } else {
        // At top - ensure header is visible
        if (currentScrollY <= SCROLL_THRESHOLD) {
          newTranslateY = 0
        } else {
          return // No change needed
        }
      }

      lastScrollY.current = currentScrollY
      if (headerRef.current) {
        headerRef.current.style.transform = `translateY(${newTranslateY}px)`

        const isHomePage = window.location.pathname === "/"
        
        if (isHomePage && window.innerWidth < MOBILE_BREAKPOINT) {
          // Home page: switch between logo and feed name, fade everything else
          const logoElement = headerRef.current.querySelector("[data-header-logo]") as HTMLElement
          const feedNameElement = headerRef.current.querySelector("[data-header-feed-name]") as HTMLElement

          if (logoElement && feedNameElement && contentRef.current) {
            const showLogo = currentScrollY <= SCROLL_THRESHOLD && newTranslateY === 0
            const opacity = 1 - Math.min(1, Math.abs(newTranslateY) / OPACITY_MIN_POINT)
            
            logoElement.style.opacity = showLogo ? "1" : "0"
            feedNameElement.style.opacity = showLogo ? "0" : "1"
            contentRef.current.style.opacity = `${opacity}`
          }
        } else if (contentRef.current) {
          // Other pages: fade out all header content
          const opacity = 1 - Math.min(1, Math.abs(newTranslateY) / OPACITY_MIN_POINT)
          contentRef.current.style.opacity = `${opacity}`
        }
      }
    }

    const handleResize = () => {
      if (headerRef.current) {
        headerRef.current.style.transform = `translateY(0px)`

        // Reset logo and feed name opacity for home page (mobile only)
        const isHomePage = window.location.pathname === "/"
        if (isHomePage && window.innerWidth < MOBILE_BREAKPOINT) {
          const logoElement = headerRef.current.querySelector(
            "[data-header-logo]"
          ) as HTMLElement
          const feedNameElement = headerRef.current.querySelector(
            "[data-header-feed-name]"
          ) as HTMLElement
          if (logoElement && feedNameElement) {
            logoElement.style.opacity = "1"
            feedNameElement.style.opacity = "0"
          }
        } else if (contentRef.current) {
          contentRef.current.style.opacity = "1"
        }
        lastScrollY.current = 0
      }
    }

    const attachScrollListener = () => {
      // Reset scroll position tracking and header position
      lastScrollY.current = 0
      if (headerRef.current) {
        headerRef.current.style.transform = "translateY(0px)"

        // Reset logo and feed name opacity for home page (mobile only)
        const isHomePage = window.location.pathname === "/"
        if (isHomePage && window.innerWidth < MOBILE_BREAKPOINT) {
          const logoElement = headerRef.current.querySelector(
            "[data-header-logo]"
          ) as HTMLElement
          const feedNameElement = headerRef.current.querySelector(
            "[data-header-feed-name]"
          ) as HTMLElement
          if (logoElement && feedNameElement) {
            logoElement.style.opacity = "1"
            feedNameElement.style.opacity = "0"
          }
        } else if (contentRef.current) {
          contentRef.current.style.opacity = "1"
        }
      }

      // Check if this header is visible (not in a display:none container)
      if (headerRef.current) {
        let checkParent: HTMLElement | null = headerRef.current
        while (checkParent) {
          const styles = window.getComputedStyle(checkParent)
          if (styles.display === "none") {
            return
          }
          checkParent = checkParent.parentElement
        }
      }

      // Look for scroll target within the same page context
      let pageRoot = headerRef.current?.parentElement
      let markedScrollTarget: HTMLElement | null = null

      while (pageRoot) {
        const target = pageRoot.querySelector(
          "[data-header-scroll-target]"
        ) as HTMLElement | null
        if (target) {
          markedScrollTarget = target
          break
        }
        pageRoot = pageRoot.parentElement
      }

      if (markedScrollTarget) {
        scrollElementRef.current = markedScrollTarget
        markedScrollTarget.addEventListener("scroll", handleScroll, {passive: true})
      } else {
        // Try to find scrollable parent first
        const scrollableParent = findScrollableParent(headerRef.current)

        if (scrollableParent) {
          scrollElementRef.current = scrollableParent
          scrollableParent.addEventListener("scroll", handleScroll, {passive: true})
        } else {
          // Look for sibling or nearby scrollable element
          const parentContainer = headerRef.current?.parentElement
          const scrollableSibling = parentContainer?.querySelector(
            ".overflow-y-auto, .overflow-y-scroll"
          )

          if (scrollableSibling) {
            scrollElementRef.current = scrollableSibling
            scrollableSibling.addEventListener("scroll", handleScroll, {passive: true})
          } else {
            // Try to find the main scrollable area
            const outlet = document.querySelector(
              ".overflow-y-scroll:not(.lg\\:block):not(.xl\\:block), .overflow-y-auto:not(.lg\\:block):not(.xl\\:block)"
            )
            if (outlet) {
              scrollElementRef.current = outlet
              outlet.addEventListener("scroll", handleScroll, {passive: true})
            } else {
              // Fallback to window scroll
              scrollElementRef.current = window
              window.addEventListener("scroll", handleScroll, {passive: true})
            }
          }
        }
      }
    }

    // Attach scroll listener with a delay to ensure DOM is ready
    const timer = setTimeout(attachScrollListener, 50)

    window.addEventListener("resize", handleResize)

    return () => {
      clearTimeout(timer)
      window.removeEventListener("resize", handleResize)

      if (scrollElementRef.current) {
        if (scrollElementRef.current === window) {
          window.removeEventListener("scroll", handleScroll)
        } else {
          ;(scrollElementRef.current as Element).removeEventListener(
            "scroll",
            handleScroll
          )
        }
      }
    }
  }, [slideUp, pathname, headerRef, contentRef, findScrollableParent])
}
