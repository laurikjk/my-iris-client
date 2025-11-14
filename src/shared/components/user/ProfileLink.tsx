import {ReactNode, MouseEvent} from "react"
import {useLocation} from "@/navigation"
import NavLink from "@/shared/components/nav/NavLink"
import {getUserRoute, isSameUserRoute} from "@/utils/usernameCache"
import {nip19} from "nostr-tools"

interface ProfileLinkProps {
  pubKey: string
  children: ReactNode | ((props: {isActive: boolean}) => ReactNode)
  className?: string | ((props: {isActive: boolean}) => string)
  onClick?: (e: MouseEvent) => void
}

/**
 * A Link component that automatically routes to the best user profile URL
 * Prefers username over npub for iris.to users
 */
export const ProfileLink = ({pubKey, children, className, onClick}: ProfileLinkProps) => {
  const location = useLocation()

  // Convert hex pubkey to the best route (username if available, otherwise npub)
  const npubRoute = `/${pubKey.startsWith("npub") ? pubKey : nip19.npubEncode(pubKey)}`
  const userRoute = getUserRoute(
    pubKey.startsWith("npub") ? pubKey : nip19.npubEncode(pubKey)
  )

  // Check if current path matches either the username or npub route
  const isActive = isSameUserRoute(location.pathname, npubRoute)

  // Use the className/children as functions if provided
  const computedClassName =
    typeof className === "function" ? className({isActive}) : className
  const computedChildren =
    typeof children === "function" ? children({isActive}) : children

  return (
    <NavLink to={userRoute} className={computedClassName} onClick={onClick}>
      {typeof children === "function"
        ? // Pass through render prop to NavLink
          children
        : // Use pre-computed children
          computedChildren}
    </NavLink>
  )
}
