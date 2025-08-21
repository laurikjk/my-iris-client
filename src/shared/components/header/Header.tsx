import {MOBILE_BREAKPOINT} from "@/shared/components/user/const.ts"
import {ReactNode, useRef, useEffect, MouseEvent} from "react"
import {RiMenuLine, RiArrowLeftLine} from "@remixicon/react"
import {useScrollableParent} from "@/shared/hooks/useScrollableParent"
import {useIsLargeScreen} from "@/shared/hooks/useIsLargeScreen"
import NotificationButton from "./NotificationButton"
import {useUserStore} from "@/stores/user"
import {useNavigate} from "@/navigation"
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
  const isLargeScreen = useIsLargeScreen()

  const headerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const lastScrollY = useRef(0)
  const {scrollContainer, findScrollableParent} = useScrollableParent(headerRef)

  useEffect(() => {
    // Only enable slideUp on mobile
    if (!slideUp || window.innerWidth >= MOBILE_BREAKPOINT) return

    const HEADER_HEIGHT = 80
    const MIN_TRANSLATE_Y = -HEADER_HEIGHT
    const MAX_TRANSLATE_Y = 0
    const OPACITY_MIN_POINT = 30
    const SCROLL_THRESHOLD = 10
    let scrollElement: Element | Window | null = null

    const handleScroll = (e?: Event) => {
      // Only handle scroll on mobile
      if (window.innerWidth >= MOBILE_BREAKPOINT) return

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
      // Reset scroll position tracking
      lastScrollY.current = 0

      // First, look for explicitly marked scroll target
      const markedScrollTarget = document.querySelector('[data-header-scroll-target]')
      
      if (markedScrollTarget) {
        scrollElement = markedScrollTarget
        markedScrollTarget.addEventListener("scroll", handleScroll, {passive: true})
      } else {
        // Try to find scrollable parent first
        const scrollableParent = findScrollableParent(headerRef.current)

        if (scrollableParent) {
          scrollElement = scrollableParent
          scrollableParent.addEventListener("scroll", handleScroll, {passive: true})
        } else {
          // Look for sibling or nearby scrollable element (for profile/thread pages)
          const parentContainer = headerRef.current?.parentElement
          const scrollableSibling = parentContainer?.querySelector(
            ".overflow-y-auto, .overflow-y-scroll"
          )

          if (scrollableSibling) {
            scrollElement = scrollableSibling
            scrollableSibling.addEventListener("scroll", handleScroll, {passive: true})
          } else {
            // Try to find the main scrollable area (outlet)
            const outlet = document.querySelector(
              ".overflow-y-scroll:not(.lg\\:block):not(.xl\\:block), .overflow-y-auto:not(.lg\\:block):not(.xl\\:block)"
            )
            if (outlet) {
              scrollElement = outlet
              outlet.addEventListener("scroll", handleScroll, {passive: true})
            } else {
              // Fallback to window scroll
              scrollElement = window
              window.addEventListener("scroll", handleScroll, {passive: true})
            }
          }
        }
      }
    }

    // Attach immediately
    attachScrollListener()

    // Re-attach after a short delay to catch dynamically rendered elements
    const REATTACH_DELAY_MS = 100
    const timeoutId = setTimeout(() => {
      if (scrollElement) {
        scrollElement.removeEventListener("scroll", handleScroll)
      }
      attachScrollListener()
    }, REATTACH_DELAY_MS)

    window.addEventListener("resize", handleResize)

    return () => {
      clearTimeout(timeoutId)
      if (scrollElement) {
        scrollElement.removeEventListener("scroll", handleScroll)
      }
      window.removeEventListener("resize", handleResize)
    }
  }, [slideUp, findScrollableParent])

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

    // First check for explicitly marked scroll target
    let scrollableParent = document.querySelector('[data-header-scroll-target]') as HTMLElement | null
    
    // If not found, try to find scrollable parent (works for nested headers)
    if (!scrollableParent) {
      scrollableParent = scrollContainer || findScrollableParent(headerRef.current) || null
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
