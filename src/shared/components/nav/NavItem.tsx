import {ReactNode, MouseEventHandler} from "react"
import Icon from "@/shared/components/Icons/Icon"
import {useUIStore} from "@/stores/ui"
import classNames from "classnames"
import NavLink from "./NavLink"
import {useLocation} from "@/navigation/hooks"
import {useFeedStore} from "@/stores/feed"
import {seenEventIds} from "@/utils/memcache"

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

    // If clicking home while already on home and viewing unseen feed, clear seen events
    if (to === "/" && location.pathname === "/" && activeFeed === "unseen") {
      // Clear the seen events cache to force refresh of unseen feed
      seenEventIds.clear()
      // Trigger feed refresh without reloading the page
      triggerFeedRefresh()
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
