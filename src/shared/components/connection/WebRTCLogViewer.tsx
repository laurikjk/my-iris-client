import {useEffect, useState} from "react"
import {webrtcLogger, type LogEntry} from "@/utils/chat/webrtc/Logger"
import {peerConnectionManager} from "@/utils/chat/webrtc/PeerConnectionManager"
import {LogViewer, LogItem} from "./LogViewer"

export function WebRTCLogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const updateLogs = () => {
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
    <LogViewer
      title="WebRTC Logs"
      logs={logs}
      isExpanded={isExpanded}
      onToggleExpanded={() => setIsExpanded(!isExpanded)}
      onClear={handleClear}
      onCopyAll={handleCopyAll}
      renderLogItem={(log, i) => (
        <LogItem
          key={i}
          timestamp={log.timestamp}
          level={log.level}
          badges={[
            <span
              key="level"
              className={`badge badge-xs ${getLevelBadge(log.level)} shrink-0`}
            >
              {log.level.toUpperCase()}
            </span>,
            log.peerId && (
              <span key="peer" className="text-base-content/70 shrink-0 font-semibold">
                [{log.peerId.slice(0, 8)}]
              </span>
            ),
          ].filter(Boolean)}
          message={log.message}
        />
      )}
    />
  )
}
