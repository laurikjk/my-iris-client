import {EventEmitter} from "tseep"
import type {NDKRelay} from "@/lib/ndk"

export type RelayLogLevel = "info" | "warn" | "error"

export interface RelayLogEntry {
  timestamp: number
  level: RelayLogLevel
  relayUrl: string
  event: string
  message: string
  details?: unknown
}

class RelayLogger extends EventEmitter<{
  log: (entry: RelayLogEntry) => void
  clear: () => void
}> {
  private logs: RelayLogEntry[] = []
  private maxLogs = 100
  private trackedRelays = new Set<NDKRelay>()

  attachToRelay(relay: NDKRelay) {
    // Skip if already tracking
    if (this.trackedRelays.has(relay)) return

    this.trackedRelays.add(relay)

    // Listen to relay events
    relay.on("connect", () => {
      this.log("info", relay.url, "connect", "Connected")
    })

    relay.on("ready", () => {
      this.log("info", relay.url, "ready", "Ready")
    })

    relay.on("disconnect", () => {
      this.log("warn", relay.url, "disconnect", "Disconnected")
    })

    relay.on("flapping", (stats) => {
      this.log(
        "warn",
        relay.url,
        "flapping",
        `Connection flapping (attempts: ${stats.attempts}, success: ${stats.success})`
      )
    })

    relay.on("notice", (notice) => {
      this.log("warn", relay.url, "notice", `${notice}`)
    })

    relay.on("auth", (challenge) => {
      this.log("info", relay.url, "auth", `Auth requested: ${challenge.slice(0, 16)}...`)
    })

    relay.on("authed", () => {
      this.log("info", relay.url, "authed", "Authenticated")
    })

    relay.on("auth:failed", (error) => {
      this.log("error", relay.url, "auth:failed", `Auth failed: ${error.message}`)
    })

    relay.on("delayed-connect", (delayInMs) => {
      this.log("warn", relay.url, "delayed-connect", `Reconnecting in ${delayInMs}ms`)
    })

    relay.on("published", (event) => {
      this.log(
        "info",
        relay.url,
        "published",
        `Published event ${event.id?.slice(0, 8)}... kind:${event.kind}`
      )
    })

    relay.on("publish:failed", (event, error) => {
      this.log(
        "error",
        relay.url,
        "publish:failed",
        `Failed to publish ${event.id?.slice(0, 8)}... kind:${event.kind}: ${error.message}`
      )
    })
  }

  detachFromRelay(relay: NDKRelay) {
    this.trackedRelays.delete(relay)
    relay.removeAllListeners()
  }

  private log(
    level: RelayLogLevel,
    relayUrl: string,
    event: string,
    message: string,
    details?: unknown
  ) {
    const entry: RelayLogEntry = {
      timestamp: Date.now(),
      level,
      relayUrl,
      event,
      message,
      details,
    }

    this.logs.push(entry)

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    this.emit("log", entry)
  }

  getLogs(): RelayLogEntry[] {
    return this.logs
  }

  clear() {
    this.logs = []
    this.emit("clear")
  }

  getTrackedRelayCount(): number {
    return this.trackedRelays.size
  }
}

export const relayLogger = new RelayLogger()
