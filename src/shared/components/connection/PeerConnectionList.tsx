import {useEffect, useState} from "react"
import {peerConnectionManager} from "@/utils/chat/webrtc/PeerConnectionManager"
import {Name} from "@/shared/components/user/Name"
import {Avatar} from "@/shared/components/user/Avatar"
import RelativeTime from "@/shared/components/event/RelativeTime"
import {RiFileTransferLine, RiPhoneLine, RiVideoChatLine} from "@remixicon/react"
import {getPeerConnection} from "@/utils/chat/webrtc/PeerConnection"
import {ProfileLink} from "@/shared/components/user/ProfileLink"
import {useSettingsStore} from "@/stores/settings"

type PeerStatus = {
  pubkey: string
  sessionId: string
  state: RTCPeerConnection["connectionState"]
  direction: "outbound" | "inbound"
  connectedAt?: number
}

export function PeerConnectionList() {
  const [peers, setPeers] = useState<PeerStatus[]>([])
  const [myPeerId, setMyPeerId] = useState<string | null>(null)
  const [sendFileModalOpen, setSendFileModalOpen] = useState(false)
  const [selectedPeer, setSelectedPeer] = useState<PeerStatus | null>(null)
  const {network} = useSettingsStore()

  useEffect(() => {
    const updatePeers = () => {
      setPeers(peerConnectionManager.getPeers())
      setMyPeerId(peerConnectionManager.getMyPeerId())
    }

    updatePeers()
    peerConnectionManager.on("update", updatePeers)

    // Also update periodically to catch discrepancies
    const interval = setInterval(updatePeers, 5000)

    return () => {
      peerConnectionManager.off("update", updatePeers)
      clearInterval(interval)
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

  const handleStartCall = async (peer: PeerStatus, type: "audio" | "video") => {
    const conn = await getPeerConnection(peer.sessionId)
    if (conn) {
      await conn.startCall(type === "video")
    }
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
      {myPeerId && (
        <div className="p-3 bg-base-200 rounded-lg">
          <div className="text-xs text-base-content/60 mb-1">My Session ID</div>
          <div className="font-mono text-sm break-all select-all">{myPeerId}</div>
        </div>
      )}

      {peers.length > 0 && (
        <div className="text-sm text-base-content/60">
          {connectedCount} of {peers.length} connected
        </div>
      )}

      {peers.length > 0 && (
        <div className="flex flex-col gap-2">
          {peers.map((peer) => (
            <div key={peer.sessionId} className="flex items-center gap-3 group">
              <ProfileLink
                pubKey={peer.pubkey}
                className="flex-1 flex items-center gap-3 p-3 bg-base-100 rounded-lg hover:bg-base-200 transition-colors cursor-pointer"
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
              </ProfileLink>
              {peer.state === "connected" && (
                <div className="flex gap-1">
                  {network.webrtcCallsEnabled && (
                    <>
                      <button
                        onClick={() => handleStartCall(peer, "audio")}
                        className="btn btn-sm btn-ghost"
                        title="Audio call"
                      >
                        <RiPhoneLine className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleStartCall(peer, "video")}
                        className="btn btn-sm btn-ghost"
                        title="Video call"
                      >
                        <RiVideoChatLine className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleSendFile(peer)}
                    className="btn btn-sm btn-ghost"
                    title="Send file"
                  >
                    <RiFileTransferLine className="w-5 h-5" />
                  </button>
                </div>
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
