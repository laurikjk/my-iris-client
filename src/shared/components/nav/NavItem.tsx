import {ReactNode, MouseEventHandler} from "react"
import Icon from "@/shared/components/Icons/Icon"
import classNames from "classnames"
import NavLink from "./NavLink"

interface NavItemProps {
  to: string
  icon?: string
  activeIcon?: string
  inactiveIcon?: string
  label: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  children?: ReactNode
  className?: string
  badge?: ReactNode
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
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
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
              <span className="absolute bottom-0 xl:bottom-auto xl:top-1/2 xl:-translate-y-1/2 xl:right-2 whitespace-nowrap text-sm">
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
