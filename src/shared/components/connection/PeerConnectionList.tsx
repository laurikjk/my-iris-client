import {useEffect, useState, useMemo} from "react"
import {peerConnectionManager} from "@/utils/chat/webrtc/PeerConnectionManager"
import {Name} from "@/shared/components/user/Name"
import {Avatar} from "@/shared/components/user/Avatar"
import RelativeTime from "@/shared/components/event/RelativeTime"
import {RiFileTransferLine, RiPhoneLine, RiVideoChatLine, RiArrowDownSLine} from "@remixicon/react"
import {getPeerConnection} from "@/utils/chat/webrtc/PeerConnection"
import {ProfileLink} from "@/shared/components/user/ProfileLink"
import {useSettingsStore} from "@/stores/settings"
import {getPeerStats} from "@/utils/chat/webrtc/peerBandwidthStats"
import {getMutualFollows} from "@/utils/socialGraph"
import {useUserStore} from "@/stores/user"
import {shouldHideUser} from "@/utils/visibility"

type PeerStatus = {
  pubkey: string
  sessionId: string
  state: RTCPeerConnection["connectionState"]
  direction: "outbound" | "inbound"
  connectedAt?: number
}

type PeerBandwidth = {
  pubkey: string
  eventsSent: number
  eventsReceived: number
  blobsSent: number
  blobsReceived: number
  eventBytesSent: number
  eventBytesReceived: number
  blobBytesSent: number
  blobBytesReceived: number
  lastSeen: number
}

export function PeerConnectionList() {
  const [peers, setPeers] = useState<PeerStatus[]>([])
  const [peerBandwidth, setPeerBandwidth] = useState<PeerBandwidth[]>([])
  const [myPeerId, setMyPeerId] = useState<string | null>(null)
  const [sendFileModalOpen, setSendFileModalOpen] = useState(false)
  const [selectedPeer, setSelectedPeer] = useState<PeerStatus | null>(null)
  const [expandedPeer, setExpandedPeer] = useState<string | null>(null)
  const {network} = useSettingsStore()
  const myPubkey = useUserStore((state) => state.publicKey)

  useEffect(() => {
    const updatePeers = () => {
      setPeers(peerConnectionManager.getPeers())
      setMyPeerId(peerConnectionManager.getMyPeerId())
    }

    const updateBandwidth = async () => {
      const stats = await getPeerStats(50)
      setPeerBandwidth(stats)
    }

    updatePeers()
    updateBandwidth()
    peerConnectionManager.on("update", updatePeers)

    // Update periodically
    const interval = setInterval(() => {
      updatePeers()
      updateBandwidth()
    }, 5000)

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

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const getBandwidthForPeer = (pubkey: string) => {
    return peerBandwidth.find((s) => s.pubkey === pubkey)
  }

  // Get mutual follows
  const mutualFollows = useMemo(() => {
    if (!myPubkey) return []
    const follows = getMutualFollows(myPubkey)
    return follows.filter((pubkey) => !shouldHideUser(pubkey))
  }, [myPubkey])

  // Merge: connected peers + bandwidth stats + mutual follows
  const allPeerPubkeys = new Set([
    ...peers.map((p) => p.pubkey),
    ...peerBandwidth.map((b) => b.pubkey),
    ...mutualFollows,
  ])

  const mergedPeers = Array.from(allPeerPubkeys).map((pubkey) => {
    const connectedPeers = peers.filter((p) => p.pubkey === pubkey)
    const bandwidth = getBandwidthForPeer(pubkey)
    const isMutualFollow = mutualFollows.includes(pubkey)
    return {pubkey, connectedPeers, bandwidth, isMutualFollow}
  })

  // Get online status (from peerConnectionManager's online users)
  const onlineUsers = peerConnectionManager.getOnlineUsers()
  const onlineSet = new Set(onlineUsers.map((u) => u.pubkey))

  // Sort: 1) connected, 2) online, 3) lastSeen
  mergedPeers.sort((a, b) => {
    const aConnected = a.connectedPeers.length > 0
    const bConnected = b.connectedPeers.length > 0
    const aOnline = onlineSet.has(a.pubkey)
    const bOnline = onlineSet.has(b.pubkey)

    if (aConnected && !bConnected) return -1
    if (!aConnected && bConnected) return 1
    if (aOnline && !bOnline) return -1
    if (!aOnline && bOnline) return 1
    return (b.bandwidth?.lastSeen || 0) - (a.bandwidth?.lastSeen || 0)
  })

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
  const connectedPubkeys = new Set(
    peers.filter((p) => p.state === "connected").map((p) => p.pubkey)
  ).size

  return (
    <div className="flex flex-col gap-4">
      {myPeerId && (
        <div className="p-3 bg-base-200 rounded-lg">
          <div className="text-xs text-base-content/60 mb-1">My Session ID</div>
          <div className="font-mono text-sm break-all select-all">{myPeerId}</div>
        </div>
      )}

      {mergedPeers.length > 0 && (
        <div className="text-sm text-base-content/60">
          {connectedPubkeys} of {mergedPeers.length} peers connected ({connectedCount} sessions)
        </div>
      )}

      {mergedPeers.length > 0 && (
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
          {mergedPeers.map((item) => {
            const bw = item.bandwidth
            const totalBytes =
              (bw?.eventBytesSent || 0) +
              (bw?.eventBytesReceived || 0) +
              (bw?.blobBytesSent || 0) +
              (bw?.blobBytesReceived || 0)

            const isExpanded = expandedPeer === item.pubkey

            return (
              <div key={item.pubkey} className="flex flex-col gap-2">
                <div
                  className="flex items-center justify-between gap-3 p-3 bg-base-100 rounded-lg hover:bg-base-200 transition-colors cursor-pointer group"
                  onClick={() => setExpandedPeer(isExpanded ? null : item.pubkey)}
                >
                  <div className="flex items-center gap-3 min-w-0" onClick={(e) => e.stopPropagation()}>
                    <ProfileLink pubKey={item.pubkey} className="flex items-center gap-3">
                    <Avatar pubKey={item.pubkey} width={32} showOnlineIndicator />
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Name pubKey={item.pubkey} />
                        {item.connectedPeers.length > 0 && (
                          <div className="flex items-center gap-1">
                            {item.connectedPeers.map((peer) => (
                              <span
                                key={peer.sessionId}
                                className="text-xs font-mono opacity-40 badge badge-xs"
                                title={`${peer.direction} - ${peer.sessionId}`}
                              >
                                {getDirectionIcon(peer.direction)} {peer.sessionId.split(":")[1]?.slice(0, 6)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.connectedPeers.length > 0 ? (
                          <>
                            <span className={`badge badge-xs ${getStatusColor(item.connectedPeers[0].state)}`}>
                              {item.connectedPeers[0].state}
                            </span>
                            {item.connectedPeers[0].connectedAt && (
                              <span className="text-xs text-base-content/60">
                                Connected <RelativeTime from={item.connectedPeers[0].connectedAt} />
                              </span>
                            )}
                          </>
                        ) : (
                          bw?.lastSeen && (
                            <span className="text-xs text-base-content/60">
                              Last seen <RelativeTime from={bw.lastSeen} />
                            </span>
                          )
                        )}
                      </div>
                    </div>
                    </ProfileLink>
                  </div>
                  <div className="flex items-center gap-3 ml-auto">
                    {bw && totalBytes > 0 && (
                      <div className="text-sm flex items-center gap-2 font-mono">
                        <span className="text-success font-semibold">
                          ↑{formatBytes(bw.eventBytesSent + bw.blobBytesSent)}
                        </span>
                        <span className="text-info font-semibold">
                          ↓{formatBytes(bw.eventBytesReceived + bw.blobBytesReceived)}
                        </span>
                      </div>
                    )}
                    {item.connectedPeers.length > 0 && item.connectedPeers[0].state === "connected" && (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {network.webrtcCallsEnabled && (
                          <>
                            <button
                              onClick={() => handleStartCall(item.connectedPeers[0], "audio")}
                              className="btn btn-sm btn-ghost"
                              title="Audio call"
                            >
                              <RiPhoneLine className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleStartCall(item.connectedPeers[0], "video")}
                              className="btn btn-sm btn-ghost"
                              title="Video call"
                            >
                              <RiVideoChatLine className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleSendFile(item.connectedPeers[0])}
                          className="btn btn-sm btn-ghost"
                          title="Send file"
                        >
                          <RiFileTransferLine className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    {bw && (
                      <RiArrowDownSLine
                        className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    )}
                  </div>
                </div>

                {isExpanded && bw && (
                  <div className="bg-base-200 rounded-lg p-3 ml-14 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div className="font-semibold col-span-2 mb-1">Sent</div>
                      <div>Events:</div>
                      <div className="font-mono">{bw.eventsSent} ({formatBytes(bw.eventBytesSent)})</div>
                      <div>Blobs:</div>
                      <div className="font-mono">{bw.blobsSent} ({formatBytes(bw.blobBytesSent)})</div>

                      <div className="font-semibold col-span-2 mt-2 mb-1">Received</div>
                      <div>Events:</div>
                      <div className="font-mono">{bw.eventsReceived} ({formatBytes(bw.eventBytesReceived)})</div>
                      <div>Blobs:</div>
                      <div className="font-mono">{bw.blobsReceived} ({formatBytes(bw.blobBytesReceived)})</div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {mergedPeers.length === 0 && (
        <div className="text-sm text-base-content/60 text-center py-4">
          No peer connections or bandwidth history
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
