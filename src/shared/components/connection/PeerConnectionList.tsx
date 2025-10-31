import {useEffect, useState} from "react"
import {peerConnectionManager} from "@/utils/chat/webrtc/PeerConnectionManager"
import {Name} from "@/shared/components/user/Name"
import {Avatar} from "@/shared/components/user/Avatar"
import RelativeTime from "@/shared/components/event/RelativeTime"

type PeerStatus = {
  pubkey: string
  sessionId: string
  state: RTCPeerConnection["connectionState"]
  direction: "outbound" | "inbound"
  connectedAt?: number
}

export function PeerConnectionList() {
  const [peers, setPeers] = useState<PeerStatus[]>([])

  useEffect(() => {
    const updatePeers = () => {
      setPeers(peerConnectionManager.getPeers())
    }

    updatePeers()
    peerConnectionManager.on("update", updatePeers)

    return () => {
      peerConnectionManager.off("update", updatePeers)
    }
  }, [])

  const getStatusColor = (state: RTCPeerConnection["connectionState"]) => {
    switch (state) {
      case "connected":
        return "badge-success"
      case "connecting":
      case "new":
        return "badge-warning"
      case "failed":
      case "closed":
        return "badge-error"
      default:
        return "badge-neutral"
    }
  }

  const getDirectionIcon = (direction: "outbound" | "inbound") => {
    return direction === "outbound" ? "↗" : "↙"
  }

  const connectedCount = peers.filter((p) => p.state === "connected").length

  return (
    <div className="flex flex-col gap-4">
      {peers.length > 0 && (
        <div className="text-sm text-base-content/60">
          {connectedCount} of {peers.length} connected
        </div>
      )}

      {peers.length > 0 && (
        <div className="flex flex-col gap-2">
          {peers.map((peer) => (
            <div
              key={peer.sessionId}
              className="flex items-center gap-3 p-3 bg-base-100 rounded-lg"
            >
              <Avatar pubKey={peer.pubkey} width={32} />
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Name pubKey={peer.pubkey} />
                  <span className="text-xs opacity-60" title={peer.direction}>
                    {getDirectionIcon(peer.direction)}
                  </span>
                  <span className="text-xs font-mono opacity-40" title={peer.sessionId}>
                    {peer.sessionId.split(":")[1]?.slice(0, 6)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge badge-xs ${getStatusColor(peer.state)}`}>
                    {peer.state}
                  </span>
                  {peer.connectedAt && (
                    <span className="text-xs text-base-content/60">
                      Connected <RelativeTime from={peer.connectedAt} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {peers.length === 0 && (
        <div className="text-sm text-base-content/60 text-center py-4">
          No active peer connections
        </div>
      )}
    </div>
  )
}
