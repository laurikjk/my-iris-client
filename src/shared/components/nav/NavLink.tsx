import {NavLink as RouterNavLink, useLocation} from "@/navigation"
import {useUIStore} from "@/stores/ui"
import {MouseEvent, ComponentProps} from "react"
import {findMainScrollContainer} from "@/shared/utils/scrollUtils"

type NavLinkProps = ComponentProps<typeof RouterNavLink>

export default function NavLink(props: NavLinkProps) {
  const {to, onClick, ...rest} = props
  const location = useLocation()

  const isActive = location.pathname === to.toString()

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // If clicking on the current route, handle scroll and refresh
    if (isActive) {
      event.preventDefault()

      const scrollContainer = findMainScrollContainer()
      if (scrollContainer) {
        const isAtTop = scrollContainer.scrollTop < 50

        // If already at top, trigger refresh signal
        if (isAtTop && to.toString() === "/") {
          const {triggerNavItemClick} = useUIStore.getState()
          triggerNavItemClick(to.toString())
        } else {
          // Not at top, just scroll up
          scrollContainer.scrollTo({top: 0, behavior: "instant"})
          // Trigger scroll event manually for instant scrolls
          scrollContainer.dispatchEvent(
            new Event("scroll", {bubbles: true, cancelable: true})
          )
        }
      }
    }

    // Call the provided onClick handler if any
    if (onClick) {
      onClick(event)
    }
  }

  return <RouterNavLink to={to} onClick={handleClick} {...rest} />
}
