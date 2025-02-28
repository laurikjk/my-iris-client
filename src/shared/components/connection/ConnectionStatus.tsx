import {getPeerConnection} from "@/pages/messages/webrtc/PeerConnection"
import {useEffect, useState} from "react"

interface ConnectionStatusProps {
  peerId: string
  size?: "xs" | "sm" | "md" | "lg"
  showDisconnect?: boolean
}

export const ConnectionStatus = ({
  peerId,
  size = "xs",
  showDisconnect = false,
}: ConnectionStatusProps) => {
  const [status, setStatus] = useState<string>()

  const handleDisconnect = () => {
    const peerConnection = getPeerConnection(peerId, {create: false})
    if (peerConnection) {
      peerConnection.close()
    }
  }

  useEffect(() => {
    let peerConnection = getPeerConnection(peerId, {create: false})

    const updateStatus = () => {
      peerConnection = getPeerConnection(peerId, {create: false})
      setStatus(peerConnection?.peerConnection.connectionState)
    }

    const handleConnectionStateChange = () => {
      setStatus(peerConnection?.peerConnection.connectionState)
    }

    // Initial status
    updateStatus()

    // Set up interval to check for new connections
    const intervalId = setInterval(updateStatus, 1000)

    // Set up connection state change listener if connection exists
    if (peerConnection) {
      peerConnection.peerConnection.addEventListener(
        "connectionstatechange",
        handleConnectionStateChange
      )
    }

    return () => {
      clearInterval(intervalId)
      if (peerConnection) {
        peerConnection.peerConnection.removeEventListener(
          "connectionstatechange",
          handleConnectionStateChange
        )
      }
    }
  }, [peerId])

  if (!status) {
    return null
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-success"
      case "disconnected":
      case "failed":
        return "bg-error"
      case "connecting":
        return "bg-warning"
      default:
        return "bg-neutral"
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`badge badge-${size} ${getStatusColor(status)}`}
        title={`Connection: ${status}`}
      />
      {showDisconnect && status === "connected" && (
        <button
          onClick={handleDisconnect}
          className="btn btn-error btn-xs btn-circle"
          title="Disconnect"
        >
          ✕
        </button>
      )}
    </div>
  )
}
