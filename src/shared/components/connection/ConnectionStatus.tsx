import {getPeerConnection} from "@/pages/messages/webrtc/PeerConnection"
import {useEffect, useState} from "react"

interface ConnectionStatusProps {
  peerId: string
  size?: "xs" | "sm" | "md" | "lg"
}

export const ConnectionStatus = ({peerId, size = "xs"}: ConnectionStatusProps) => {
  const [status, setStatus] = useState<string>()

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
    <span
      className={`badge badge-${size} ${getStatusColor(status)}`}
      title={`Connection: ${status}`}
    />
  )
}
