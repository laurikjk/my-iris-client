import {useEffect, useState, useRef} from "react"
import {getAllConnections, getPeerConnection} from "@/utils/chat/webrtc/PeerConnection"
import {Name} from "@/shared/components/user/Name"
import {Avatar} from "@/shared/components/user/Avatar"
import {
  RiPhoneFill,
  RiPhoneLine,
  RiVideoChatLine,
  RiMicLine,
  RiMicOffLine,
  RiCameraLine,
  RiCameraOffLine,
} from "@remixicon/react"
import {useSettingsStore} from "@/stores/settings"

type CallRequest = {
  sessionId: string
  pubkey: string
  hasVideo: boolean
}

type ActiveCall = {
  sessionId: string
  pubkey: string
  hasVideo: boolean
  localStream: MediaStream | null
  remoteStream: MediaStream | null
}

export function CallManager() {
  const [requests, setRequests] = useState<CallRequest[]>([])
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [endedCall, setEndedCall] = useState<{pubkey: string; hasVideo: boolean} | null>(
    null
  )
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const [attachedListeners] = useState(
    new Map<
      string,
      {
        callIncoming: (hasVideo: boolean) => void
        callStarted: (hasVideo: boolean, localStream: MediaStream) => void
        remoteStream: (stream: MediaStream) => void
        close: () => void
      }
    >()
  )
  const {network, updateNetwork} = useSettingsStore()

  useEffect(() => {
    const handleCallIncoming = (sessionId: string, pubkey: string) => {
      return (hasVideo: boolean) => {
        // Auto-reject if already in a call
        if (activeCall) {
          getPeerConnection(sessionId).then((conn) => {
            conn?.sendJsonData({type: "call-rejected", reason: "busy"})
          })
          return
        }

        setRequests((prev) => {
          if (prev.some((r) => r.sessionId === sessionId)) return prev
          return [...prev, {sessionId, pubkey, hasVideo}]
        })
      }
    }

    const handleCallStarted = (sessionId: string, pubkey: string) => {
      return (hasVideo: boolean, localStream: MediaStream) => {
        setActiveCall({
          sessionId,
          pubkey,
          hasVideo,
          localStream,
          remoteStream: null,
        })
      }
    }

    const handleRemoteStream = (sessionId: string) => {
      return (stream: MediaStream) => {
        setActiveCall((prev) => {
          if (!prev || prev.sessionId !== sessionId) return prev
          return {...prev, remoteStream: stream}
        })
      }
    }

    const handleCallClose = (sessionId: string) => {
      return () => {
        setRequests((prev) => prev.filter((r) => r.sessionId !== sessionId))
        setActiveCall((prev) => {
          if (prev?.sessionId === sessionId) {
            // Clean up local media when connection closes
            prev.localStream?.getTracks().forEach((track) => track.stop())

            // Show "call ended" screen
            setEndedCall({pubkey: prev.pubkey, hasVideo: prev.hasVideo})

            return null
          }
          return prev
        })
      }
    }

    const attachListenersToConnections = () => {
      const connections = getAllConnections()

      for (const [sessionId, conn] of connections) {
        if (!attachedListeners.has(sessionId)) {
          const pubkey = conn.recipientPubkey
          const listeners = {
            callIncoming: handleCallIncoming(sessionId, pubkey),
            callStarted: handleCallStarted(sessionId, pubkey),
            remoteStream: handleRemoteStream(sessionId),
            close: handleCallClose(sessionId),
          }

          conn.on("call-incoming", listeners.callIncoming)
          conn.on("call-started", listeners.callStarted)
          conn.on("remote-stream", listeners.remoteStream)
          conn.on("close", listeners.close)

          attachedListeners.set(sessionId, listeners)
        }
      }

      for (const [sessionId] of attachedListeners) {
        if (!connections.has(sessionId)) {
          attachedListeners.delete(sessionId)
        }
      }
    }

    attachListenersToConnections()
    const interval = setInterval(attachListenersToConnections, 2000)

    return () => {
      clearInterval(interval)
      attachedListeners.clear()
    }
  }, [attachedListeners])

  // Update video elements when streams change
  useEffect(() => {
    if (localVideoRef.current && activeCall?.localStream) {
      localVideoRef.current.srcObject = activeCall.localStream
    }
    if (remoteVideoRef.current && activeCall?.remoteStream) {
      remoteVideoRef.current.srcObject = activeCall.remoteStream
    }
  }, [activeCall])

  const handleAccept = async (request: CallRequest) => {
    setRequests((prev) => prev.filter((r) => r.sessionId !== request.sessionId))

    const conn = await getPeerConnection(request.sessionId)
    if (!conn) return

    // Show call UI immediately
    setActiveCall({
      sessionId: request.sessionId,
      pubkey: request.pubkey,
      hasVideo: request.hasVideo,
      localStream: null,
      remoteStream: conn.remoteStream,
    })

    try {
      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: request.hasVideo,
      })

      // Update with local stream
      setActiveCall((prev) =>
        prev?.sessionId === request.sessionId ? {...prev, localStream: stream} : prev
      )

      // Add tracks to connection
      for (const track of stream.getTracks()) {
        conn.peerConnection.addTrack(track, stream)
      }

      // Renegotiate to send our tracks back
      const offer = await conn.peerConnection.createOffer()
      await conn.peerConnection.setLocalDescription(offer)

      // Import dynamically to avoid circular dependency
      const {sendSignalingMessage} = await import("@/utils/chat/webrtc/signaling")
      const {default: socialGraph} = await import("@/utils/socialGraph")

      await sendSignalingMessage(
        {
          type: "offer",
          offer,
          recipient: conn.peerId,
          peerId: conn.mySessionId || socialGraph().getRoot(),
        },
        conn.recipientPubkey
      )
    } catch (error) {
      console.error("Failed to accept call:", error)
      setActiveCall(null)
    }
  }

  const handleReject = (request: CallRequest) => {
    setRequests((prev) => prev.filter((r) => r.sessionId !== request.sessionId))
  }

  const handleEndCall = async () => {
    if (!activeCall) return

    const callInfo = {pubkey: activeCall.pubkey, hasVideo: activeCall.hasVideo}

    // Stop local media
    activeCall.localStream?.getTracks().forEach((track) => track.stop())

    // Stop call but keep connection alive for data channel
    const conn = await getPeerConnection(activeCall.sessionId)
    if (conn) {
      conn.stopCall(true) // Notify remote peer
    }

    setActiveCall(null)

    // Show "call ended" screen
    setEndedCall(callInfo)
  }

  const handleCallBack = async (pubkey: string, hasVideo: boolean) => {
    setEndedCall(null)

    // Find peer connection for this pubkey
    const connections = getAllConnections()
    for (const [, conn] of connections) {
      if (
        conn.recipientPubkey === pubkey &&
        conn.peerConnection.connectionState === "connected"
      ) {
        await conn.startCall(hasVideo)
        return
      }
    }
  }

  const toggleMute = () => {
    if (!activeCall?.localStream) return
    const audioTrack = activeCall.localStream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      setIsMuted(!audioTrack.enabled)
    }
  }

  const toggleVideo = () => {
    if (!activeCall?.localStream) return
    const videoTrack = activeCall.localStream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      setIsVideoOff(!videoTrack.enabled)
    }
  }

  return (
    <>
      {/* Incoming call requests - iPhone style */}
      {requests.map((request) => (
        <div
          key={request.sessionId}
          className="fixed inset-0 bg-black z-50 flex flex-col"
        >
          {/* Top section with caller info */}
          <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
            <div className="flex flex-col items-center gap-4">
              <Avatar pubKey={request.pubkey} width={120} />
              <div className="flex flex-col items-center gap-1">
                <Name
                  pubKey={request.pubkey}
                  className="text-3xl text-white font-semibold"
                />
                <div className="text-white/60 text-lg">
                  {request.hasVideo ? "Video" : ""} Call
                </div>
              </div>
            </div>

            {/* Settings toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!network.webrtcCallsEnabled}
                onChange={(e) => updateNetwork({webrtcCallsEnabled: !e.target.checked})}
                className="checkbox checkbox-sm"
              />
              <span className="text-sm text-white/60">{"Don't ask again"}</span>
            </label>
          </div>

          {/* Bottom buttons - iPhone style */}
          <div className="p-8 flex justify-center gap-12 mb-12">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => handleReject(request)}
                className="btn btn-circle btn-lg btn-error"
              >
                <RiPhoneFill className="w-8 h-8 rotate-[135deg]" />
              </button>
              <span className="text-white/60 text-sm">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => handleAccept(request)}
                className="btn btn-circle btn-lg btn-success"
              >
                <RiPhoneFill className="w-8 h-8" />
              </button>
              <span className="text-white/60 text-sm">Accept</span>
            </div>
          </div>
        </div>
      ))}

      {/* Call ended screen */}
      {endedCall && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            <Avatar pubKey={endedCall.pubkey} width={96} />
            <div className="flex flex-col items-center gap-2">
              <Name
                pubKey={endedCall.pubkey}
                className="text-2xl text-white font-semibold"
              />
              <div className="text-white/60">Call Ended</div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => handleCallBack(endedCall.pubkey, false)}
                className="btn btn-circle btn-lg btn-success"
                title="Call back (audio)"
              >
                <RiPhoneLine className="w-8 h-8" />
              </button>
              {endedCall.hasVideo && (
                <button
                  onClick={() => handleCallBack(endedCall.pubkey, true)}
                  className="btn btn-circle btn-lg btn-success"
                  title="Call back (video)"
                >
                  <RiVideoChatLine className="w-8 h-8" />
                </button>
              )}
              <button
                onClick={() => setEndedCall(null)}
                className="btn btn-circle btn-lg btn-ghost"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active call view */}
      {activeCall && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Call info header */}
          <div className="p-4 bg-base-300/80 backdrop-blur absolute top-0 left-0 right-0 z-10">
            <div className="flex items-center gap-3">
              <Avatar pubKey={activeCall.pubkey} width={32} />
              <div className="flex-1">
                <Name pubKey={activeCall.pubkey} className="text-white font-semibold" />
                <div className="text-xs text-white/60">
                  {activeCall.hasVideo ? "Video call" : "Audio call"}
                  {!activeCall.remoteStream && " - connecting..."}
                </div>
              </div>
            </div>
          </div>

          {/* Remote video (full screen) */}
          <div className="flex-1 relative">
            {activeCall.hasVideo ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-base-300">
                <div className="flex flex-col items-center gap-4">
                  <Avatar pubKey={activeCall.pubkey} width={128} />
                  <Name pubKey={activeCall.pubkey} className="text-2xl" />
                  <div className="text-base-content/60">Audio call in progress</div>
                </div>
              </div>
            )}

            {/* Local video (picture-in-picture) */}
            {activeCall.hasVideo && activeCall.localStream && (
              <div className="absolute top-4 right-4 w-32 h-24 bg-black rounded-lg overflow-hidden shadow-lg">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-6 bg-base-300 flex justify-center gap-4">
            <button
              onClick={toggleMute}
              className={`btn btn-circle ${isMuted ? "btn-error" : "btn-ghost"}`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <RiMicOffLine className="w-6 h-6" />
              ) : (
                <RiMicLine className="w-6 h-6" />
              )}
            </button>

            {activeCall.hasVideo && (
              <button
                onClick={toggleVideo}
                className={`btn btn-circle ${isVideoOff ? "btn-error" : "btn-ghost"}`}
                title={isVideoOff ? "Turn on camera" : "Turn off camera"}
              >
                {isVideoOff ? (
                  <RiCameraOffLine className="w-6 h-6" />
                ) : (
                  <RiCameraLine className="w-6 h-6" />
                )}
              </button>
            )}

            <button onClick={handleEndCall} className="btn btn-circle btn-error">
              <RiPhoneFill className="w-6 h-6 rotate-[135deg]" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
