import {useNavigate, useLocation} from "react-router"
import {useSessionsStore} from "@/stores/sessions"
import {useUserStore} from "@/stores/user"
import {useUIStore} from "@/stores/ui"
import {useEffect} from "react"

export const useInviteFromUrl = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const publicKey = useUserStore((state) => state.publicKey)
  const privateKey = useUserStore((state) => state.privateKey)
  const setShowLoginDialog = useUIStore((state) => state.setShowLoginDialog)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    // Check if hash is present and looks like an invite
    if (!location.hash) {
      return
    }

    // Only treat as invite if it looks like a proper invite URL
    // Invite URLs should contain parameters like "invite" or be nostr: protocol URLs
    const hash = location.hash.slice(1) // Remove the #
    const isInviteUrl =
      hash.includes("invite") ||
      hash.startsWith("nostr:") ||
      decodeURIComponent(hash).includes("invite")

    if (!isInviteUrl) {
      return
    }

    if (!publicKey) {
      timeoutId = setTimeout(() => {
        setShowLoginDialog(true)
      }, 500)
    } else {
      const acceptInviteFromUrl = async () => {
        const fullUrl = `${window.location.origin}${location.pathname}${location.search}${location.hash}`

        // Clear the invite from URL history by replacing current state with a clean URL
        const cleanUrl = `${window.location.origin}${location.pathname}${location.search}`
        window.history.replaceState({}, document.title, cleanUrl)

        const sessionId = await useSessionsStore.getState().acceptInvite(fullUrl)
        navigate("/chats/chat", {state: {id: sessionId}})
      }

      acceptInviteFromUrl()
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [location, publicKey, privateKey, navigate, setShowLoginDialog])
}
