import {NavLink as RouterNavLink, useLocation} from "@/navigation"
import {useUIStore} from "@/stores/ui"
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
      // Signal that the active nav item was clicked with its path
      const {triggerNavItemClick} = useUIStore.getState()
      triggerNavItemClick(to.toString())
    }
  }

  return <RouterNavLink to={to} onClick={handleClick} {...rest} />
}
