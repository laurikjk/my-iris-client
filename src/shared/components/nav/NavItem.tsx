import {ReactNode, MouseEventHandler} from "react"
import Icon from "@/shared/components/Icons/Icon"
import {useUIStore} from "@/stores/ui"
import classNames from "classnames"
import NavLink from "./NavLink"
import {useLocation} from "@/navigation/hooks"
import {useFeedStore} from "@/stores/feed"
import {seenEventIds} from "@/utils/memcache"
import {findMainScrollContainer, isMainContentAtTop} from "@/shared/utils/scrollUtils"

interface NavItemProps {
  to: string
  icon?: string
  activeIcon?: string
  inactiveIcon?: string
  label: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  children?: ReactNode
  className?: string
  badge?: string | number
}

export const NavItem = ({
  to,
  icon,
  activeIcon,
  inactiveIcon,
  label,
  onClick,
  children,
  className,
  badge,
}: NavItemProps) => {
  const {setIsSidebarOpen} = useUIStore()
  const location = useLocation()
  const {activeFeed, triggerFeedRefresh} = useFeedStore()

  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    setIsSidebarOpen(false)

    // If already at the same URL, scroll to top
    if (location.pathname === to) {
      e.preventDefault()

      const scrollContainer = findMainScrollContainer()

      if (scrollContainer && scrollContainer.scrollTop > 0) {
        // Scroll to top if not already at top
        scrollContainer.scrollTo({top: 0, behavior: "instant"})
      } else if (to === "/" && isMainContentAtTop()) {
        // Special handling for home button when already at top - reload feed
        if (activeFeed === "unseen") {
          // Clear the seen events cache for unseen feed
          seenEventIds.clear()
        }
        // Trigger feed refresh
        triggerFeedRefresh()
      }
    }

    onClick?.(e)
  }

  return (
    <li>
      <NavLink
        title={label}
        to={to}
        onClick={handleClick}
        className={({isActive}) =>
          classNames(className, {
            "bg-base-100": isActive,
            "rounded-full md:aspect-square xl:aspect-auto flex md:justify-center xl:justify-start items-center": true,
          })
        }
      >
        {({isActive}) => (
          <>
            <Icon
              className="w-6 h-6"
              name={
                (isActive ? activeIcon : inactiveIcon) ||
                (icon ? `${icon}-${isActive ? "solid" : "outline"}` : "")
              }
            />
            <span className="inline md:hidden xl:inline">{label}</span>
            {badge && (
              <span className="badge badge-sm absolute bottom-0 xl:bottom-auto xl:top-1/2 xl:-translate-y-1/2 xl:right-2">
                {badge}
              </span>
            )}
            {children}
          </>
        )}
      </NavLink>
    </li>
  )
}
