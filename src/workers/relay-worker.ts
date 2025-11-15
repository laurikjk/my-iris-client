/**
 * Relay Worker
 *
 * Runs NDK with actual WebSocket relay connections in a worker thread.
 * Main thread communicates via NDKWorkerTransport.
 * Cache operations delegated to separate cache worker.
 */

// Can't use path aliases in worker, use relative imports
import NDK from "../lib/ndk"
import {NDKEvent} from "../lib/ndk/events"
import type {NDKFilter} from "../lib/ndk/subscription"
import {NDKRelay} from "../lib/ndk/relay"
import NDKCacheAdapterDexie from "../lib/ndk-cache"

interface WorkerMessage {
  type:
    | "init"
    | "subscribe"
    | "unsubscribe"
    | "publish"
    | "close"
    | "getRelayStatus"
    | "addRelay"
    | "removeRelay"
    | "connectRelay"
    | "disconnectRelay"
  id?: string
  filters?: NDKFilter[]
  event?: any
  relays?: string[]
  url?: string
}

interface WorkerResponse {
  type:
    | "ready"
    | "event"
    | "eose"
    | "notice"
    | "published"
    | "error"
    | "relayStatus"
    | "relayAdded"
    | "relayConnected"
    | "relayDisconnected"
  subId?: string
  event?: any
  relay?: string
  notice?: string
  error?: string
  id?: string
  relayStatuses?: Array<{
    url: string
    status: number
    stats?: {
      attempts: number
      success: number
      connectedAt?: number
    }
  }>
}

let ndk: NDK
let cache: NDKCacheAdapterDexie
const subscriptions = new Map<string, any>()

// Default relays if none provided
const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.snort.social",
  "wss://relay.nostr.band",
]

async function initialize(relayUrls?: string[]) {
  try {
    console.log("[Relay Worker] Starting initialization with relays:", relayUrls)

    // Initialize Dexie cache for writing only (main thread handles reads)
    console.log("[Relay Worker] Initializing cache adapter...")
    cache = new NDKCacheAdapterDexie({
      dbName: "treelike-nostr",
      saveSig: true,
    })
    console.log("[Relay Worker] Cache adapter ready (write-only, main thread queries)")

    // Initialize NDK with relay connections
    const relaysToUse = relayUrls && relayUrls.length > 0 ? relayUrls : DEFAULT_RELAYS
    console.log("[Relay Worker] Creating NDK with relays:", relaysToUse)

    ndk = new NDK({
      explicitRelayUrls: relaysToUse,
      cacheAdapter: cache, // For writing fresh events to cache
      enableOutboxModel: false,
    })

    // Forward relay notices to main thread
    ndk.pool?.on("notice", (relay: any, notice: string) => {
      self.postMessage({
        type: "notice",
        relay: relay.url,
        notice,
      } as WorkerResponse)
    })

    // Connect to relays
    console.log("[Relay Worker] Connecting to relays...")
    await ndk.connect()

    console.log(
      `[Relay Worker] Initialized with ${ndk.pool?.relays.size || 0} relays`,
    )

    // Signal ready
    self.postMessage({type: "ready"} as WorkerResponse)
  } catch (error) {
    console.error("[Relay Worker] Initialization failed:", error)
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    } as WorkerResponse)
  }
}

function handleSubscribe(subId: string, filters: NDKFilter[]) {
  if (!ndk) {
    console.error("[Relay Worker] NDK not initialized")
    return
  }

  // Clean up existing subscription with same ID
  if (subscriptions.has(subId)) {
    subscriptions.get(subId).stop()
  }

  const sub = ndk.subscribe(filters, {
    closeOnEose: false,
    groupable: true,
    cacheUsage: "PARALLEL" as any, // Query cache + relays (main has no cache)
  })

  sub.on("event", (event: NDKEvent) => {
    self.postMessage({
      type: "event",
      subId,
      event: event.rawEvent(),
    } as WorkerResponse)
  })

  sub.on("eose", () => {
    self.postMessage({
      type: "eose",
      subId,
    } as WorkerResponse)
  })

  subscriptions.set(subId, sub)
}

function handleUnsubscribe(subId: string) {
  const sub = subscriptions.get(subId)
  if (sub) {
    sub.stop()
    subscriptions.delete(subId)
  }
}

async function handlePublish(id: string, eventData: any, relayUrls?: string[]) {
  if (!ndk) {
    self.postMessage({
      type: "error",
      id,
      error: "NDK not initialized",
    } as WorkerResponse)
    return
  }

  try {
    console.log("[Relay Worker] Publishing event:", eventData.id)
    const event = new NDKEvent(ndk, eventData)

    // Publish to specified relays or all connected relays
    let relays: any = undefined
    if (relayUrls && relayUrls.length > 0) {
      relays = ndk.pool?.relays
        ? Array.from(ndk.pool.relays.values()).filter((r) =>
            relayUrls.includes(r.url),
          )
        : undefined
      console.log("[Relay Worker] Publishing to specific relays:", relayUrls, "found:", relays?.length)
    } else {
      console.log("[Relay Worker] Publishing to all relays, pool size:", ndk.pool?.relays.size)
    }

    // Increase timeout to allow relays to connect (10s)
    await event.publish(relays, 10_000)

    console.log("[Relay Worker] Event published successfully:", eventData.id)
    self.postMessage({
      type: "published",
      id,
    } as WorkerResponse)
  } catch (error) {
    console.error("[Relay Worker] Publish failed:", error)
    self.postMessage({
      type: "error",
      id,
      error: error instanceof Error ? error.message : String(error),
    } as WorkerResponse)
  }
}

function handleGetRelayStatus(requestId: string) {
  if (!ndk?.pool) {
    self.postMessage({
      type: "relayStatus",
      id: requestId,
      relayStatuses: [],
    } as WorkerResponse)
    return
  }

  const statuses = Array.from(ndk.pool.relays.values()).map((relay) => ({
    url: relay.url,
    status: relay.status,
    stats: {
      attempts: relay.connectivity?.connectionStats.attempts || 0,
      success: relay.connectivity?.connectionStats.success || 0,
      connectedAt: (relay.connectivity as any)?.connectedAt,
    },
  }))

  self.postMessage({
    type: "relayStatus",
    id: requestId,
    relayStatuses: statuses,
  } as WorkerResponse)
}

function handleAddRelay(url: string) {
  if (!ndk?.pool) return
  const relay = new NDKRelay(url, undefined, ndk)
  ndk.pool.addRelay(relay)
  relay.connect()
}

function handleRemoveRelay(url: string) {
  if (!ndk?.pool) return
  const relay = ndk.pool.relays.get(url)
  if (relay) {
    relay.disconnect()
    ndk.pool.relays.delete(url)
  }
}

function handleConnectRelay(url: string) {
  if (!ndk?.pool) return
  const relay = ndk.pool.relays.get(url)
  relay?.connect()
}

function handleDisconnectRelay(url: string) {
  if (!ndk?.pool) return
  const relay = ndk.pool.relays.get(url)
  relay?.disconnect()
}

function handleClose() {
  // Stop all subscriptions
  subscriptions.forEach((sub) => sub.stop())
  subscriptions.clear()

  // Disconnect from relays
  if (ndk?.pool) {
    ndk.pool.relays.forEach((relay) => relay.disconnect())
  }
}

// Message handler
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const data = e.data
  const {type, id, filters, event, relays, url} = data

  switch (type) {
    case "init":
      await initialize(relays)
      break

    case "subscribe":
      if (id && filters) {
        handleSubscribe(id, filters as NDKFilter[])
      }
      break

    case "unsubscribe":
      if (id) {
        handleUnsubscribe(id)
      }
      break

    case "publish":
      if (id && event) {
        await handlePublish(id, event, relays)
      }
      break

    case "getRelayStatus":
      if (id) {
        handleGetRelayStatus(id)
      }
      break

    case "addRelay":
      if (data.url) {
        handleAddRelay(data.url)
      }
      break

    case "removeRelay":
      if (data.url) {
        handleRemoveRelay(data.url)
      }
      break

    case "connectRelay":
      if (data.url) {
        handleConnectRelay(data.url)
      }
      break

    case "disconnectRelay":
      if (data.url) {
        handleDisconnectRelay(data.url)
      }
      break

    case "close":
      handleClose()
      break

    default:
      console.warn("[Relay Worker] Unknown message type:", type)
  }
}

// Handle errors
self.onerror = (error) => {
  console.error("[Relay Worker] Error:", error)
  self.postMessage({
    type: "error",
    error: error instanceof Error ? error.message : String(error),
  } as WorkerResponse)
}
