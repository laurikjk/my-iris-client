import {useLocalState} from "irisdb-hooks/src/useLocalState"
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
}: NavItemProps) => {
  const [, setIsSidebarOpen] = useLocalState("isSidebarOpen", false)

  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    setIsSidebarOpen(false)
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
            "rounded-full md:aspect-square xl:aspect-auto flex md:justify-center xl:justify-start items-center":
              true,
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
            {children}
          </>
        )}
      </NavLink>
    </li>
  )
}
