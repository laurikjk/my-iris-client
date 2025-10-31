import {useEffect, useState} from "react"
import {peerConnectionManager} from "@/utils/chat/webrtc/PeerConnectionManager"
import {Name} from "@/shared/components/user/Name"
import {Avatar} from "@/shared/components/user/Avatar"
import RelativeTime from "@/shared/components/event/RelativeTime"
import {RiFileTransferLine} from "@remixicon/react"
import {getPeerConnection} from "@/utils/chat/webrtc/PeerConnection"

type PeerStatus = {
  pubkey: string
  sessionId: string
  state: RTCPeerConnection["connectionState"]
  direction: "outbound" | "inbound"
  connectedAt?: number
}

export function PeerConnectionList() {
  const [peers, setPeers] = useState<PeerStatus[]>([])
  const [sendFileModalOpen, setSendFileModalOpen] = useState(false)
  const [selectedPeer, setSelectedPeer] = useState<PeerStatus | null>(null)

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

  const handleSendFile = (peer: PeerStatus) => {
    setSelectedPeer(peer)
    setSendFileModalOpen(true)
  }

  const handleFileSelect = async (file: File) => {
    if (!selectedPeer) return

    const conn = await getPeerConnection(selectedPeer.sessionId)
    if (conn) {
      conn.sendFile(file)
    }

    setSendFileModalOpen(false)
    setSelectedPeer(null)
  }

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
              {peer.state === "connected" && (
                <button
                  onClick={() => handleSendFile(peer)}
                  className="btn btn-sm btn-ghost"
                  title="Send file"
                >
                  <RiFileTransferLine className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {peers.length === 0 && (
        <div className="text-sm text-base-content/60 text-center py-4">
          No active peer connections
        </div>
      )}

      {/* File send modal */}
      {sendFileModalOpen && selectedPeer && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              Send File to <Name pubKey={selectedPeer.pubkey} />
            </h3>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  handleFileSelect(file)
                }
              }}
              className="file-input file-input-bordered w-full"
            />
            <div className="modal-action">
              <button
                onClick={() => {
                  setSendFileModalOpen(false)
                  setSelectedPeer(null)
                }}
                className="btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
