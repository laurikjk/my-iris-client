import {useState, useEffect} from "react"
import {RiSignalTowerLine} from "@remixicon/react"
import {peerConnectionManager} from "@/utils/chat/webrtc/PeerConnectionManager"
import {useUIStore} from "@/stores/ui"
import {Link} from "@/navigation"

interface PeerConnectionIndicatorProps {
  className?: string
  showCount?: boolean
}

export const PeerConnectionIndicator = ({
  className = "",
  showCount = true,
}: PeerConnectionIndicatorProps) => {
  const {showRelayIndicator} = useUIStore()
  const [connectedCount, setConnectedCount] = useState(0)

  useEffect(() => {
    const updateCount = () => {
      setConnectedCount(peerConnectionManager.getConnectionCount())
    }

    updateCount()
    peerConnectionManager.on("update", updateCount)

    return () => {
      peerConnectionManager.off("update", updateCount)
    }
  }, [])

  const getColorClass = () => {
    if (connectedCount === 0) return "text-base-content/30"
    return "text-success"
  }

  if (!showRelayIndicator) return null

  return (
    <Link
      to="/settings/network"
      className={`flex items-center justify-center gap-1 ${getColorClass()} ${className} hover:opacity-75 transition-opacity`}
      title={`${connectedCount} peers connected`}
    >
      <RiSignalTowerLine className="w-5 h-5" />
      {showCount && <span className="text-sm font-bold">{connectedCount}</span>}
    </Link>
  )
}
