import {useEffect, useState} from "react"
import {getAllConnections, getPeerConnection} from "@/utils/chat/webrtc/PeerConnection"
import {Name} from "@/shared/components/user/Name"
import {Avatar} from "@/shared/components/user/Avatar"

type FileTransferRequest = {
  sessionId: string
  pubkey: string
  metadata: {
    name: string
    size: number
    type: string
  }
}

export function FileTransferManager() {
  const [requests, setRequests] = useState<FileTransferRequest[]>([])
  const [attachedListeners] = useState(
    new Map<string, (metadata: {name: string; size: number; type: string}) => void>()
  )

  useEffect(() => {
    const handleFileIncoming = (sessionId: string, pubkey: string) => {
      return (metadata: {name: string; size: number; type: string}) => {
        setRequests((prev) => {
          // Avoid duplicates
          if (prev.some((r) => r.sessionId === sessionId)) return prev
          return [...prev, {sessionId, pubkey, metadata}]
        })
      }
    }

    const handleFileClose = (sessionId: string) => {
      return () => {
        setRequests((prev) => prev.filter((r) => r.sessionId !== sessionId))
      }
    }

    const attachListenersToConnections = () => {
      const connections = getAllConnections()

      // Attach listeners to new connections
      for (const [sessionId, conn] of connections) {
        if (!attachedListeners.has(sessionId)) {
          const pubkey = conn.recipientPubkey
          const listener = handleFileIncoming(sessionId, pubkey)
          attachedListeners.set(sessionId, listener)
          conn.on("file-incoming", listener)
          conn.on("close", handleFileClose(sessionId))
        }
      }

      // Remove listeners for closed connections
      for (const [sessionId, listener] of attachedListeners) {
        if (!connections.has(sessionId)) {
          const conn = connections.get(sessionId)
          conn?.off("file-incoming", listener)
          attachedListeners.delete(sessionId)
        }
      }
    }

    // Initial attachment
    attachListenersToConnections()

    // Re-check periodically for new connections
    const interval = setInterval(attachListenersToConnections, 2000)

    return () => {
      clearInterval(interval)
      // Cleanup all listeners
      const connections = getAllConnections()
      for (const [sessionId, listener] of attachedListeners) {
        const conn = connections.get(sessionId)
        conn?.off("file-incoming", listener)
      }
      attachedListeners.clear()
    }
  }, [attachedListeners])

  const handleAccept = async (request: FileTransferRequest) => {
    const conn = await getPeerConnection(request.sessionId)
    if (conn) {
      // Listen for file-received to close modal
      conn.once("file-received", () => {
        setRequests((prev) => prev.filter((r) => r.sessionId !== request.sessionId))
      })
      conn.acceptFileTransfer()
    }
  }

  const handleReject = async (request: FileTransferRequest) => {
    setRequests((prev) => prev.filter((r) => r.sessionId !== request.sessionId))
    const conn = await getPeerConnection(request.sessionId)
    if (conn) {
      conn.rejectFileTransfer()
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (requests.length === 0) return null

  return (
    <>
      {requests.map((request) => (
        <div key={request.sessionId} className="modal modal-open">
          <div className="modal-box">
            <div className="flex items-center gap-3 mb-4">
              <Avatar pubKey={request.pubkey} width={48} />
              <div className="flex flex-col">
                <h3 className="font-bold text-lg">Incoming File</h3>
                <span className="text-sm text-base-content/60">
                  from <Name pubKey={request.pubkey} />
                </span>
              </div>
            </div>

            <div className="bg-base-200 p-4 rounded-lg mb-4">
              <div className="text-sm">
                <div className="font-semibold mb-1">{request.metadata.name}</div>
                <div className="text-base-content/60">
                  {formatFileSize(request.metadata.size)}
                </div>
              </div>
            </div>

            <div className="modal-action">
              <button onClick={() => handleReject(request)} className="btn btn-error">
                Reject
              </button>
              <button onClick={() => handleAccept(request)} className="btn btn-primary">
                Accept
              </button>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
