import {useEffect, useState} from "react"
import {webrtcLogger, type LogEntry} from "@/utils/chat/webrtc/Logger"
import {peerConnectionManager} from "@/utils/chat/webrtc/PeerConnectionManager"
import {LogViewer, LogItem} from "./LogViewer"
import {getCachedName} from "@/utils/nostr"

export function WebRTCLogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [filterText, setFilterText] = useState("")

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

  const filteredLogs = filterText
    ? logs.filter((log) => {
        const searchText = filterText.toLowerCase()
        const peerPubkey = log.peerId?.split(":")[0] || ""
        const peerName = peerPubkey ? getCachedName(peerPubkey).toLowerCase() : ""
        return (
          log.message.toLowerCase().includes(searchText) ||
          log.level.toLowerCase().includes(searchText) ||
          peerPubkey.toLowerCase().includes(searchText) ||
          peerName.includes(searchText)
        )
      })
    : logs

  const handleClear = () => {
    webrtcLogger.clear()
  }

  const handleCopyAll = () => {
    const myPeerId = peerConnectionManager.getMyPeerId()
    const header = myPeerId ? `My Peer ID: ${myPeerId}\n\n` : ""
    const text = filteredLogs
      .map((log) => {
        const timestamp = new Date(log.timestamp).toISOString()
        const peerId = log.peerId ? `[${log.peerId}] ` : ""
        return `${timestamp} ${log.level.toUpperCase()} ${peerId}${log.message}`
      })
      .join("\n")
    navigator.clipboard.writeText(header + text)
  }

  return (
    <LogViewer
      title="WebRTC Logs"
      logs={filteredLogs}
      isExpanded={isExpanded}
      onToggleExpanded={() => setIsExpanded(!isExpanded)}
      onClear={handleClear}
      onCopyAll={handleCopyAll}
      filterText={filterText}
      onFilterChange={setFilterText}
      renderLogItem={(log, i) => {
        const badges = log.peerId
          ? [
              <span
                key="peer"
                className={`badge badge-xs ${
                  log.direction === "up"
                    ? "badge-success"
                    : log.direction === "down"
                      ? "badge-info"
                      : "badge-neutral"
                } shrink-0 gap-1`}
              >
                {getCachedName(log.peerId.split(":")[0])} (
                {log.peerId.split(":")[0].slice(0, 8)})
                {log.direction === "up" ? " ↑" : log.direction === "down" ? " ↓" : ""}
              </span>,
            ]
          : []

        return (
          <LogItem
            key={i}
            timestamp={log.timestamp}
            level={log.level}
            badges={badges}
            message={log.message}
          />
        )
      }}
    />
  )
}
