import {useEffect, useState} from "react"
import {relayLogger, type RelayLogEntry} from "@/utils/relay/RelayLogger"
import {LogViewer, LogItem} from "./LogViewer"

export function RelayLogViewer() {
  const [logs, setLogs] = useState<RelayLogEntry[]>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const updateLogs = () => {
      setLogs([...relayLogger.getLogs()].reverse())
    }

    updateLogs()
    relayLogger.on("log", updateLogs)
    relayLogger.on("clear", updateLogs)

    return () => {
      relayLogger.off("log", updateLogs)
      relayLogger.off("clear", updateLogs)
    }
  }, [])

  const handleClear = () => {
    relayLogger.clear()
  }

  const handleCopyAll = () => {
    const text = logs
      .map((log) => {
        const timestamp = new Date(log.timestamp).toISOString()
        return `${timestamp} ${log.level.toUpperCase()} [${log.relayUrl}] ${log.event}: ${log.message}`
      })
      .join("\n")
    navigator.clipboard.writeText(text)
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

  const getEventBadge = (event: string) => {
    switch (event) {
      case "connect":
      case "ready":
      case "authed":
      case "published":
        return "badge-success"
      case "disconnect":
      case "flapping":
      case "delayed-connect":
      case "notice":
        return "badge-warning"
      case "auth:failed":
      case "publish:failed":
        return "badge-error"
      default:
        return "badge-ghost"
    }
  }

  const getRelayName = (url: string) => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch {
      return url
    }
  }

  return (
    <LogViewer
      title="Relay Logs"
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
            <span
              key="event"
              className={`badge badge-xs ${getEventBadge(log.event)} shrink-0`}
            >
              {log.event}
            </span>,
            <span key="relay" className="text-base-content/70 shrink-0 font-semibold">
              {getRelayName(log.relayUrl)}
            </span>,
          ]}
          message={log.message}
        />
      )}
    />
  )
}
