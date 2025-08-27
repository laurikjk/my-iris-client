import UnseenMessagesBadge from "@/shared/components/messages/UnseenMessagesBadge"
import Icon from "@/shared/components/Icons/Icon"
import {MouseEventHandler} from "react"
import classNames from "classnames"
import NavLink from "./NavLink"

interface MessagesNavItemProps {
  label: string
  to: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

export const MessagesNavItem = ({label, to, onClick}: MessagesNavItemProps) => {
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
          classNames({
            "bg-base-100": isActive,
            "rounded-full md:aspect-square xl:aspect-auto flex items-center": true,
          })
        }
      >
        {({isActive}) => (
          <span className="flex items-center gap-2">
            <span className="indicator">
              <UnseenMessagesBadge />
              <Icon name={`mail-${isActive ? "solid" : "outline"}`} className="w-6 h-6" />
            </span>
            <span className="inline md:hidden xl:inline">{label}</span>
          </span>
        )}
      </NavLink>
    </li>
  )
}
