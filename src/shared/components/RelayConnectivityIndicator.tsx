import {useState, useEffect} from "react"
import {RiWebhookLine} from "@remixicon/react"
import {useUIStore} from "@/stores/ui"
import {Link} from "@/navigation"
import {peerConnectionManager} from "@/utils/chat/webrtc/PeerConnectionManager"
import {useWorkerRelayStatus} from "@/shared/hooks/useWorkerRelayStatus"
import {useOnlineStatus} from "@/shared/hooks/useOnlineStatus"

interface RelayConnectivityIndicatorProps {
  className?: string
  showCount?: boolean
}

export const RelayConnectivityIndicator = ({
  className = "",
  showCount = true,
}: RelayConnectivityIndicatorProps) => {
  const {showRelayIndicator} = useUIStore()
  const workerRelays = useWorkerRelayStatus()
  const [peerCount, setPeerCount] = useState(0)
  const isOnline = useOnlineStatus()

  useEffect(() => {
    const updatePeerCount = () => {
      setPeerCount(peerConnectionManager.getConnectionCount())
    }

    updatePeerCount()
    peerConnectionManager.on("update", updatePeerCount)

    return () => {
      peerConnectionManager.off("update", updatePeerCount)
    }
  }, [])

  // Count connected relays from worker
  const relayCount = workerRelays.relays.filter((r) => r.status >= 5).length // NDKRelayStatus.CONNECTED = 5

  const totalCount = relayCount + peerCount

  const getColorClass = () => {
    if (totalCount === 0) return "text-error"
    if (peerCount > 0) return "text-info"
    if (relayCount === 1) return "text-warning"
    return "text-neutral-500"
  }

  if (!showRelayIndicator) return null

  return (
    <Link
      to="/settings/network"
      className={`flex items-center justify-center gap-1 ${getColorClass()} ${className} hover:opacity-75 transition-opacity`}
      title={`${relayCount} relays, ${peerCount} peers connected`}
    >
      {!isOnline && <span className="text-xs text-error mr-1">offline</span>}
      <RiWebhookLine className="w-5 h-5" />
      {showCount && <span className="text-sm font-bold">{totalCount}</span>}
    </Link>
  )
}
