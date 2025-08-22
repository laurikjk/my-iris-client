import {ReactNode, useRef} from "react"
import {RiMenuLine} from "@remixicon/react"
import {useScrollableParent} from "@/shared/hooks/useScrollableParent"
import {useIsLargeScreen} from "@/shared/hooks/useIsLargeScreen"
import NotificationButton from "./NotificationButton"
import UnseenMessagesBadge from "@/shared/components/messages/UnseenMessagesBadge"
import Icon from "@/shared/components/Icons/Icon"
import {useUserStore} from "@/stores/user"
import {useLocation, useNavigate} from "@/navigation"
import {useUIStore} from "@/stores/ui"
import classNames from "classnames"
import {useHeaderScroll} from "./useHeaderScroll"
import {HeaderNavigation} from "./HeaderNavigation"
import {useHeaderClick} from "./useHeaderClick"

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
  const location = useLocation()
  const navigate = useNavigate()
  const isLargeScreen = useIsLargeScreen()

  const headerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const {scrollContainer, findScrollableParent} = useScrollableParent(headerRef)

  // Use extracted scroll hook
  useHeaderScroll({
    slideUp,
    headerRef,
    contentRef,
    pathname: location.pathname,
  })

  const handleHeaderClick = useHeaderClick({
    headerRef,
    scrollContainer,
    findScrollableParent,
    scrollDown,
  })

  const handleMenuClick = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const leftButton = showBack ? (
    <HeaderNavigation showBack={showBack} />
  ) : (
    <button onClick={handleMenuClick} className="btn btn-ghost btn-circle md:hidden">
      <RiMenuLine className="w-6 h-6" />
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
        <div className="flex items-center gap-2 mr-2">
          {myPubKey && (
            <>
              {location.pathname === "/" && (
                <button
                  onClick={() => navigate("/chats")}
                  className="md:hidden btn btn-ghost btn-circle relative"
                  title="Messages"
                >
                  <span className="indicator">
                    <UnseenMessagesBadge />
                    <Icon
                      className="w-5 h-5"
                      name={
                        location.pathname.startsWith("/chats")
                          ? "mail-solid"
                          : "mail-outline"
                      }
                    />
                  </span>
                </button>
              )}
              {showNotifications && (
                <div className="md:hidden">
                  <NotificationButton />
                </div>
              )}
            </>
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
