import {useEffect, useState} from "react"
import {webrtcLogger, type LogEntry} from "@/utils/chat/webrtc/Logger"
import {peerConnectionManager} from "@/utils/chat/webrtc/PeerConnectionManager"
import {LogViewer, LogItem} from "./LogViewer"
import {Name} from "@/shared/components/user/Name"
import {getCachedName} from "@/utils/nostr"
import {ProfileLink} from "@/shared/components/user/ProfileLink"

function stringToHue(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash % 360)
}

function getPeerColor(peerId: string): string {
  const pubkey = peerId.split(":")[0]
  const hue = stringToHue(pubkey)
  return `hsl(${hue}, 70%, 50%)`
}

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
        const pubkey = log.peerId?.split(":")[0]
        const isBroadcast = pubkey === "broadcast"

        const getArrow = () => {
          if (log.direction === "up") {
            return (
              <span key="arrow" style={{color: "#22c55e", fontSize: "1.2em"}}>
                ↗
              </span>
            )
          }
          if (log.direction === "down") {
            return (
              <span key="arrow" style={{color: "#ef4444", fontSize: "1.2em"}}>
                ↙
              </span>
            )
          }
          return (
            <span key="arrow" style={{fontSize: "1.2em", visibility: "hidden"}}>
              ↗
            </span>
          )
        }

        const getPeerBadge = () => {
          const peerId = log.peerId || ""
          if (isBroadcast) {
            return (
              <span
                key="peer"
                className="badge badge-xs shrink-0 gap-1"
                style={{
                  backgroundColor: getPeerColor(peerId),
                  color: "white",
                  borderColor: getPeerColor(peerId),
                }}
              >
                broadcast
              </span>
            )
          }
          if (pubkey) {
            return (
              <ProfileLink key="peer" pubKey={pubkey}>
                <span
                  className="badge badge-xs shrink-0 gap-1 cursor-pointer hover:opacity-80"
                  style={{
                    backgroundColor: getPeerColor(peerId),
                    color: "white",
                    borderColor: getPeerColor(peerId),
                  }}
                >
                  <Name pubKey={pubkey} /> ({pubkey.slice(0, 8)})
                </span>
              </ProfileLink>
            )
          }
          return (
            <span
              key="peer"
              className="badge badge-xs shrink-0 gap-1"
              style={{
                backgroundColor: getPeerColor(peerId),
                color: "white",
                borderColor: getPeerColor(peerId),
              }}
            >
              unknown
            </span>
          )
        }

        const badges = log.peerId ? [getArrow(), getPeerBadge()] : []

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
