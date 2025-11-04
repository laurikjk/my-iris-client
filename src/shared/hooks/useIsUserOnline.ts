import {useState, useEffect} from "react"
import {peerConnectionManager} from "@/utils/chat/webrtc/PeerConnectionManager"

/**
 * Hook to check if a user is online via WebRTC presence.
 * Subscribes to peerConnectionManager updates for efficiency.
 */
export function useIsUserOnline(pubkey: string | undefined): boolean {
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    if (!pubkey) {
      setIsOnline(false)
      return
    }

    const checkOnlineStatus = () => {
      const onlineUsers = peerConnectionManager.getOnlineUsers()
      const online = onlineUsers.some((u) => u.pubkey === pubkey)
      setIsOnline(online)
    }

    // Initial check
    checkOnlineStatus()

    // Subscribe to updates
    peerConnectionManager.on("update", checkOnlineStatus)

    return () => {
      peerConnectionManager.off("update", checkOnlineStatus)
    }
  }, [pubkey])

  return isOnline
}
