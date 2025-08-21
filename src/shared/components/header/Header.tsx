import {MOBILE_BREAKPOINT} from "@/shared/components/user/const.ts"
import {ReactNode, useRef, useEffect, MouseEvent} from "react"
import {RiMenuLine, RiArrowLeftLine} from "@remixicon/react"
import {useScrollableParent} from "@/shared/hooks/useScrollableParent"
import {useIsLargeScreen} from "@/shared/hooks/useIsLargeScreen"
import NotificationButton from "./NotificationButton"
import {useUserStore} from "@/stores/user"
import {useNavigate, useLocation} from "@/navigation"
import {useUIStore} from "@/stores/ui"
import classNames from "classnames"

interface HeaderProps {
  title?: string
  children?: ReactNode
  showBack?: boolean
  showNotifications?: boolean
  scrollDown?: boolean
  slideUp?: boolean
  bold?: boolean
}

const Header = ({
  title,
  children,
  showBack = true,
  showNotifications = true,
  scrollDown = false,
  slideUp = true,
  bold = true,
}: HeaderProps) => {
  const {isSidebarOpen, setIsSidebarOpen, setShowLoginDialog} = useUIStore()
  const myPubKey = useUserStore((state) => state.publicKey)
  const navigate = useNavigate()
  const location = useLocation()
  const isLargeScreen = useIsLargeScreen()

  const headerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const lastScrollY = useRef(0)
  const scrollElementRef = useRef<Element | Window | null>(null)
  const {scrollContainer, findScrollableParent} = useScrollableParent(headerRef)

  // Initialize header transform on mount and navigation
  useEffect(() => {
    if (headerRef.current && slideUp) {
      headerRef.current.style.transform = "translateY(0px)"
      if (contentRef.current) {
        contentRef.current.style.opacity = "1"
      }
    }
  }, [slideUp, location.pathname])

  useEffect(() => {
    // Only enable slideUp on mobile
    if (!slideUp || window.innerWidth >= MOBILE_BREAKPOINT) return

    // Check if this is a main page header (not inside a feed item)
    // Feed item headers are usually inside elements with specific classes
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
        if (contentRef.current) {
          contentRef.current.style.opacity = `${1 - Math.min(1, newTranslateY / -OPACITY_MIN_POINT)}`
        }
      }
    }

    const handleResize = () => {
      if (headerRef.current) {
        headerRef.current.style.transform = `translateY(0px)`
        if (contentRef.current) {
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
        if (contentRef.current) {
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

      // Look for scroll target within the same page context (not globally)
      // This is important because the router keeps all pages mounted with display:none
      // Find the closest parent that contains data-header-scroll-target
      let pageRoot = headerRef.current?.parentElement
      let markedScrollTarget: HTMLElement | null = null

      while (pageRoot) {
        // Check if this container has the scroll target
        const target = pageRoot.querySelector(
          "[data-header-scroll-target]"
        ) as HTMLElement | null
        if (target) {
          markedScrollTarget = target
          break
        }
        // Keep going up until we find a scroll target or reach the top
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
          // Look for sibling or nearby scrollable element (for profile/thread pages)
          const parentContainer = headerRef.current?.parentElement
          const scrollableSibling = parentContainer?.querySelector(
            ".overflow-y-auto, .overflow-y-scroll"
          )

          if (scrollableSibling) {
            scrollElementRef.current = scrollableSibling
            scrollableSibling.addEventListener("scroll", handleScroll, {passive: true})
          } else {
            // Try to find the main scrollable area (outlet)
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

    // Clean up any existing listeners first
    const cleanup = () => {
      if (scrollElementRef.current) {
        scrollElementRef.current.removeEventListener("scroll", handleScroll)
        scrollElementRef.current = null
      }
    }

    // Attach immediately
    cleanup()
    attachScrollListener()

    // Re-attach after a short delay to catch dynamically rendered elements
    // But only if we didn't already find a scroll target
    const REATTACH_DELAY_MS = 100
    const timeoutId = setTimeout(() => {
      if (!scrollElementRef.current) {
        cleanup()
        attachScrollListener()
      }
    }, REATTACH_DELAY_MS)

    // Watch for new scroll targets being added to DOM
    const observer = new MutationObserver(() => {
      // Find the closest parent that contains data-header-scroll-target
      let pageRoot = headerRef.current?.parentElement
      let newScrollTarget: HTMLElement | null = null

      while (pageRoot) {
        const target = pageRoot.querySelector(
          "[data-header-scroll-target]"
        ) as HTMLElement | null
        if (target) {
          newScrollTarget = target
          break
        }
        pageRoot = pageRoot.parentElement
      }

      if (newScrollTarget && newScrollTarget !== scrollElementRef.current) {
        cleanup()
        attachScrollListener()
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-header-scroll-target"],
    })

    window.addEventListener("resize", handleResize)

    return () => {
      clearTimeout(timeoutId)
      cleanup()
      observer.disconnect()
      window.removeEventListener("resize", handleResize)
    }
  }, [slideUp, findScrollableParent, location.pathname])

  const getButtonContent = () => {
    if (showBack) return <RiArrowLeftLine className="w-6 h-6" />
    return <RiMenuLine className="w-6 h-6" />
  }

  const handleButtonClick = () => {
    if (showBack) {
      // idx works only in production for some reason
      // in production we dont want the history.length check
      // because it could return you out of the app
      const canGoBack = window.history.state?.index > 0

      if (canGoBack) {
        navigate(-1)
      } else {
        navigate("/")
      }
    } else {
      setIsSidebarOpen(!isSidebarOpen)
    }
  }

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
      scrollableParent =
        scrollContainer || findScrollableParent(headerRef.current) || null
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

  const leftButton = getButtonContent() && (
    <button
      onClick={handleButtonClick}
      className={classNames("btn btn-ghost btn-circle", {"md:hidden": !showBack})}
    >
      {getButtonContent()}
    </button>
  )

  return (
    <header
      ref={headerRef}
      onClick={handleHeaderClick}
      style={slideUp ? {transform: "translateY(0px)"} : undefined}
      className={classNames(
        "pt-[env(safe-area-inset-top)] min-h-16 flex top-0 bg-base-200 md:bg-opacity-80 md:backdrop-blur-sm text-base-content p-2 z-30 select-none w-full cursor-pointer",
        isLargeScreen ? "sticky" : "fixed"
      )}
    >
      <div ref={contentRef} className="flex justify-between items-center flex-1 w-full">
        <div className="flex items-center gap-2 w-full">
          {leftButton}
          <div
            className={classNames("flex items-center gap-4 w-full text-base-content", {
              "text-lg font-semibold": bold,
            })}
          >
            {children || title}
          </div>
        </div>
        <div className="flex items-center gap-4 mr-2">
          {showNotifications && myPubKey && (
            <div className="md:hidden">
              <NotificationButton />
            </div>
          )}
          {!myPubKey && (
            <button
              className="md:hidden btn btn-sm btn-primary"
              onClick={() => setShowLoginDialog(true)}
            >
              Sign up
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
