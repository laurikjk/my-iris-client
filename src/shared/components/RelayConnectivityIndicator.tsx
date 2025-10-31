import {useState, useEffect} from "react"
import {RiWebhookLine} from "@remixicon/react"
import {ndk as getNdk} from "@/utils/ndk"
import {useUIStore} from "@/stores/ui"
import {Link} from "@/navigation"
import {peerConnectionManager} from "@/utils/chat/webrtc/PeerConnectionManager"

interface RelayConnectivityIndicatorProps {
  className?: string
  showCount?: boolean
}

export const RelayConnectivityIndicator = ({
  className = "",
  showCount = true,
}: RelayConnectivityIndicatorProps) => {
  const {showRelayIndicator} = useUIStore()
  const [ndkRelays, setNdkRelays] = useState(new Map())
  const [peerCount, setPeerCount] = useState(0)

  useEffect(() => {
    const updateStats = () => {
      const ndk = getNdk()
      setNdkRelays(new Map(ndk.pool.relays))
    }

    updateStats()
    const interval = setInterval(updateStats, 2000)
    return () => clearInterval(interval)
  }, [])

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

  // Count all connected relays (both configured and discovered)
  const relayCount = Array.from(ndkRelays.values()).filter(
    (relay) => relay.connected
  ).length

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
      <RiWebhookLine className="w-5 h-5" />
      {showCount && <span className="text-sm font-bold">{totalCount}</span>}
    </Link>
  )
}
