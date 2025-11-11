import {EventEmitter} from "tseep"
import {useSettingsStore} from "@/stores/settings"

type LogLevel = "debug" | "info" | "warn" | "error"

type LogEntry = {
  timestamp: number
  level: LogLevel
  peerId?: string
  direction?: "up" | "down"
  message: string
  data?: unknown
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class WebRTCLogger extends EventEmitter {
  private logs: LogEntry[] = []
  private maxLogs = 100

  private shouldLog(level: LogLevel): boolean {
    const configuredLevel = useSettingsStore.getState().network.webrtcLogLevel || "info"
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel]
  }

  log(
    level: LogLevel,
    peerId: string | undefined,
    message: string,
    direction?: "up" | "down"
  ) {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      peerId,
      direction,
      message,
    }

    this.logs.push(entry)

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // Also log to console with color-coded peer IDs
    let prefix = "[webrtc]"
    let color = "#888"

    if (peerId) {
      // Check if peerId is in pubkey:uuid format
      if (peerId.includes(":")) {
        const [pubkey, uuid] = peerId.split(":")
        const pubkeySlice = pubkey.slice(0, 8)
        const uuidSlice = uuid.slice(0, 6)
        prefix = `[${pubkeySlice}:${uuidSlice}]`
        // Generate consistent color from uuid for different sessions
        const hash = uuid.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
        const colors = [
          "#ff6b6b",
          "#4ecdc4",
          "#45b7d1",
          "#96ceb4",
          "#ffeaa7",
          "#dfe6e9",
          "#a29bfe",
          "#fd79a8",
        ]
        color = colors[hash % colors.length]
      } else {
        prefix = `[${peerId}]`
      }
    }

    const directionStr = direction ? ` ${direction}` : ""
    console.log(
      `%c${prefix}%c${directionStr} ${message}`,
      `color: ${color}; font-weight: bold`,
      ""
    )

    this.emit("log", entry)
  }

  debug(peerId: string | undefined, message: string, direction?: "up" | "down") {
    this.log("debug", peerId, message, direction)
  }

  info(peerId: string | undefined, message: string, direction?: "up" | "down") {
    this.log("info", peerId, message, direction)
  }

  warn(peerId: string | undefined, message: string, direction?: "up" | "down") {
    this.log("warn", peerId, message, direction)
  }

  error(peerId: string | undefined, message: string, direction?: "up" | "down") {
    this.log("error", peerId, message, direction)
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  clear() {
    this.logs = []
    this.emit("clear")
  }
}

export const webrtcLogger = new WebRTCLogger()
export type {LogEntry, LogLevel}
