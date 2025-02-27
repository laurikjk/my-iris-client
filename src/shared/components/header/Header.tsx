import {useEffect, useRef, useState, useCallback, MouseEvent} from "react"
import {RiMenuLine, RiArrowLeftLine} from "@remixicon/react"
import {useLocation, useNavigate} from "react-router"

import NotificationButton from "@/shared/components/header/NotificationButton.tsx"
import {MOBILE_BREAKPOINT} from "@/shared/components/user/const.ts"
import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {UserRow} from "@/shared/components/user/UserRow"
import ErrorBoundary from "../ui/ErrorBoundary"
import {Avatar} from "../user/Avatar"

export default function Header() {
  const [myPubKey] = useLocalState("user/publicKey", "", String)

  const [, setShowLoginDialog] = useLocalState("home/showLoginDialog", false)

  const [isSidebarOpen, setSidebarOpen] = useLocalState("isSidebarOpen", false)

  const location = useLocation()
  const isChatRoute = location.pathname === "/messages/chat"
  const isThread = location.pathname.startsWith("/note")
  const isProfile = location.pathname.startsWith("/npub")
  const navigate = useNavigate()
  let pageName = location.pathname.split("/")[1]

  if (pageName.startsWith("note")) {
    pageName = "note"
  } else if (pageName.startsWith("npub")) {
    pageName = "profile"
  }

  const mySetTitle = () => {
    setTitle(document.title.replace(` / ${CONFIG.appName}`, ""))
  }

  const [title, setTitle] = useState(document.title)
  useEffect(() => {
    // special weapons and tactics
    const timeout1 = setTimeout(() => {
      mySetTitle()
    }, 0)
    const timeout2 = setTimeout(() => {
      mySetTitle()
    }, 100)
    const timeout3 = setTimeout(() => {
      mySetTitle()
    }, 1000)

    return () => {
      clearTimeout(timeout1)
      clearTimeout(timeout2)
      clearTimeout(timeout3)
    }
  }, [location])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false)
      }
    }

    const handleClick = () => {
      setSidebarOpen(false)
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("click", handleClick)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("click", handleClick)
    }
  }, [])

  const headerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const lastScrollY = useRef(window.scrollY)

  useEffect(() => {
    const MIN_TRANSLATE_Y = -80
    const MAX_TRANSLATE_Y = 0
    const OPACITY_MIN_POINT = 30

    const handleScroll = () => {
      if (window.innerWidth >= MOBILE_BREAKPOINT || isChatRoute) {
        return
      }
      const currentScrollY = window.scrollY
      let newTranslateY = 0
      if (currentScrollY > lastScrollY.current) {
        // Scrolling down
        // bypass React's setState loop for smoother animation
        newTranslateY = Math.max(
          MIN_TRANSLATE_Y,
          parseFloat(
            headerRef
              .current!.style.transform.replace("translateY(", "")
              .replace("px)", "")
          ) -
            (currentScrollY - lastScrollY.current)
        )
      } else {
        // Scrolling up
        newTranslateY = Math.min(
          MAX_TRANSLATE_Y,
          parseFloat(
            headerRef
              .current!.style.transform.replace("translateY(", "")
              .replace("px)", "")
          ) +
            (lastScrollY.current - currentScrollY)
        )
      }
      lastScrollY.current = currentScrollY
      headerRef.current!.style.transform = `translateY(${newTranslateY}px)`
      contentRef.current!.style.opacity = `${1 - Math.min(1, newTranslateY / -OPACITY_MIN_POINT)}`
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [isChatRoute])

  const showBackArrow = isChatRoute || isThread || isProfile
  const chatId = location.state?.id
  const chatUserPubkey = chatId?.split(":").shift()

  const handleBackClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      if (window.history.state?.idx > 0) {
        navigate(-1)
      } else {
        navigate("/messages")
      }
    },
    [navigate]
  )

  const handleButtonClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      if (showBackArrow) {
        handleBackClick(e)
      } else {
        setSidebarOpen(!isSidebarOpen)
      }
    },
    [showBackArrow, handleBackClick]
  )

  const getButtonContent = () => {
    if (showBackArrow) return <RiArrowLeftLine className="w-6 h-6" />
    return myPubKey ? (
      <Avatar pubKey={myPubKey} width={32} showBadge={false} />
    ) : (
      <RiMenuLine className="w-6 h-6" />
    )
  }

  return (
    <ErrorBoundary>
      <header
        ref={headerRef}
        style={{transform: `translateY(0px)`}}
        className="md:hidden shadow-theme-xl mb-8 flex fixed top-0 left-0 right-0 bg-base-200 text-base-content p-2 z-30 select-none"
      >
        <div
          ref={contentRef}
          className="flex md:pl-20 xl:pl-40 justify-between items-center flex-1 max-w-screen-lg mx-auto"
        >
          <div className="flex items-center gap-2">
            <button
              tabIndex={0}
              onClick={handleButtonClick}
              className="md:hidden btn btn-ghost btn-circle"
            >
              {getButtonContent()}
            </button>
            <div className="flex items-center gap-4">
              {isChatRoute && chatUserPubkey ? (
                <UserRow avatarWidth={32} pubKey={chatUserPubkey} />
              ) : (
                <h1
                  className="text-lg text-base-content cursor-pointer"
                  onClick={() => window.scrollTo(0, 0)}
                >
                  {title}
                </h1>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mr-2">
            {myPubKey ? (
              <div className="md:hidden">
                <NotificationButton />
              </div>
            ) : (
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
    </ErrorBoundary>
  )
}
