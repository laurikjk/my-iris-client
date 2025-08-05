import {NavLink as RouterNavLink, useLocation} from "@/navigation"
import {useNotificationsStore} from "@/stores/notifications"
import {MouseEvent, ComponentProps} from "react"

type NavLinkProps = ComponentProps<typeof RouterNavLink>

export default function NavLink(props: NavLinkProps) {
  const {to, onClick, ...rest} = props
  const location = useLocation()

  const isActive = location.pathname === to.toString()

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(event)
    }

    if (isActive) {
      if (window.scrollY === 0) {
        const {updateRefreshRouteSignal} = useNotificationsStore.getState()
        updateRefreshRouteSignal()
      } else {
        window.scrollTo({top: 0, behavior: "instant"})
      }
    }
  }

  return <RouterNavLink to={to} onClick={handleClick} {...rest} />
}
