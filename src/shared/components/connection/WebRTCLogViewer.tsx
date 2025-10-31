import {useEffect, useState} from "react"
import {webrtcLogger, type LogEntry} from "@/utils/chat/webrtc/Logger"
import RelativeTime from "@/shared/components/event/RelativeTime"
import {peerConnectionManager} from "@/utils/chat/webrtc/PeerConnectionManager"

export function WebRTCLogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    const updateLogs = () => {
      // Reverse logs so newest is at top
      setLogs([...webrtcLogger.getLogs()].reverse())
    }

    updateLogs()
    webrtcLogger.on("log", updateLogs)
    webrtcLogger.on("clear", updateLogs)

    return () => {
      webrtcLogger.off("log", updateLogs)
      webrtcLogger.off("clear", updateLogs)
    }
  }, [])

  const handleClear = () => {
    webrtcLogger.clear()
  }

  const handleCopyAll = () => {
    const myPeerId = peerConnectionManager.getMyPeerId()
    const header = myPeerId ? `My Peer ID: ${myPeerId}\n\n` : ""
    const text = logs
      .map((log) => {
        const timestamp = new Date(log.timestamp).toISOString()
        const peerId = log.peerId ? `[${log.peerId}] ` : ""
        return `${timestamp} ${log.level.toUpperCase()} ${peerId}${log.message}`
      })
      .join("\n")
    navigator.clipboard.writeText(header + text)
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "text-error"
      case "warn":
        return "text-warning"
      default:
        return "text-base-content"
    }
  }

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "error":
        return "badge-error"
      case "warn":
        return "badge-warning"
      default:
        return "badge-info"
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold">WebRTC Logs</span>
        <div className="flex gap-2">
          <button onClick={handleCopyAll} className="btn btn-xs btn-ghost">
            Copy All
          </button>
          <button onClick={handleClear} className="btn btn-xs btn-ghost">
            Clear
          </button>
        </div>
      </div>

      <div className="bg-base-300 rounded-lg p-3 max-h-96 overflow-y-auto font-mono text-xs space-y-1 select-text">
        {logs.length === 0 ? (
          <div className="text-base-content/50 text-center py-4">No logs yet</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`flex gap-2 ${getLevelColor(log.level)}`}>
              <span className="text-base-content/50 shrink-0 w-16 text-right">
                <RelativeTime from={log.timestamp} />
              </span>
              <span className={`badge badge-xs ${getLevelBadge(log.level)} shrink-0`}>
                {log.level.toUpperCase()}
              </span>
              {log.peerId && (
                <span className="text-base-content/70 shrink-0 font-semibold">
                  [{log.peerId.slice(0, 8)}]
                </span>
              )}
              <span className="break-all">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
