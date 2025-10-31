import {EventEmitter} from "tseep"

type LogLevel = "info" | "warn" | "error"

type LogEntry = {
  timestamp: number
  level: LogLevel
  peerId?: string
  message: string
  data?: unknown
}

class WebRTCLogger extends EventEmitter {
  private logs: LogEntry[] = []
  private maxLogs = 100

  log(level: LogLevel, peerId: string | undefined, message: string, ...data: unknown[]) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      peerId,
      message,
      data: data.length > 0 ? data : undefined,
    }

    this.logs.push(entry)

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    this.emit("log", entry)

    // Also log to console
    const prefix = peerId ? `[WebRTC ${peerId}]` : "[WebRTC]"
    const consoleArgs = [prefix, message, ...(data || [])]

    switch (level) {
      case "error":
        console.error(...consoleArgs)
        break
      case "warn":
        console.warn(...consoleArgs)
        break
      default:
        console.log(...consoleArgs)
    }
  }

  info(peerId: string | undefined, message: string, ...data: unknown[]) {
    this.log("info", peerId, message, ...data)
  }

  warn(peerId: string | undefined, message: string, ...data: unknown[]) {
    this.log("warn", peerId, message, ...data)
  }

  error(peerId: string | undefined, message: string, ...data: unknown[]) {
    this.log("error", peerId, message, ...data)
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
