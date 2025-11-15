/**
 * Relay Worker
 *
 * Runs NDK with actual WebSocket relay connections in a worker thread.
 * Main thread communicates via NDKWorkerTransport.
 * Cache operations delegated to separate cache worker.
 */

// Can't use path aliases in worker, use relative imports
import {createDebugLogger} from "../utils/createDebugLogger"
import {DEBUG_NAMESPACES} from "../utils/constants"
const {log, warn, error} = createDebugLogger(DEBUG_NAMESPACES.NDK_RELAY)

import NDK from "../lib/ndk"
import {NDKEvent} from "../lib/ndk/events"
import type {NDKFilter} from "../lib/ndk/subscription"
import {NDKSubscriptionCacheUsage} from "../lib/ndk/subscription"
import {NDKRelay} from "../lib/ndk/relay"
import NDKCacheAdapterDexie from "../lib/ndk-cache"

// WASM sig verification - nostr-wasm Nostr interface
interface WasmVerifier {
  verifyEvent(event: unknown): void // throws on invalid sig
}
let wasmVerifier: WasmVerifier | null = null
let wasmLoading = false

async function loadWasm() {
  if (wasmVerifier || wasmLoading) return
  wasmLoading = true
  try {
    const {initNostrWasm} = await import("nostr-wasm")
    wasmVerifier = await initNostrWasm()
    log("[Relay Worker] WASM sig verifier loaded")
  } catch (err) {
    error("[Relay Worker] WASM load failed:", err)
  } finally {
    wasmLoading = false
  }
}

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
    | "reconnectDisconnected"
  id?: string
  filters?: NDKFilter[]
  event?: any
  relays?: string[]
  url?: string
  subscribeOpts?: WorkerSubscribeOpts
  publishOpts?: WorkerPublishOpts
  reason?: string
}

interface WorkerSubscribeOpts {
  destinations?: ("cache" | "relay")[] // Where to query: default ["cache", "relay"]
  closeOnEose?: boolean
  groupable?: boolean
}

interface WorkerPublishOpts {
  publishTo?: ("cache" | "relay" | "subscriptions")[] // Where to send: default ["relay"]
  verifySignature?: boolean // Verify sig in worker before dispatch (for untrusted sources)
  source?: string // Source identifier (e.g., "webrtc:peerId")
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
    log("[Relay Worker] Starting initialization with relays:", relayUrls)

    // Initialize Dexie cache for writing only (main thread handles reads)
    log("[Relay Worker] Initializing cache adapter...")
    cache = new NDKCacheAdapterDexie({
      dbName: "treelike-nostr",
      saveSig: true,
    })
    log("[Relay Worker] Cache adapter ready (write-only, main thread queries)")

    // Initialize NDK with relay connections
    const relaysToUse = relayUrls && relayUrls.length > 0 ? relayUrls : DEFAULT_RELAYS
    log("[Relay Worker] Creating NDK with relays:", relaysToUse)

    ndk = new NDK({
      explicitRelayUrls: relaysToUse,
      cacheAdapter: cache, // For writing fresh events to cache
      enableOutboxModel: false,
    })

    // Setup custom sig verification with wasm fallback
    ndk.signatureVerificationFunction = async (event: NDKEvent) => {
      if (wasmVerifier) {
        try {
          wasmVerifier.verifyEvent({
            id: event.id,
            sig: event.sig!,
            pubkey: event.pubkey,
            content: event.content,
            kind: event.kind!,
            created_at: event.created_at!,
            tags: event.tags,
          })
          return true
        } catch {
          return false
        }
      }
      // Fallback to JS verification until wasm loads
      return !!event.verifySignature(false)
    }

    // Lazy load wasm in background
    loadWasm()

    // Forward relay notices to main thread
    ndk.pool?.on("notice", (relay: NDKRelay, notice: string) => {
      self.postMessage({
        type: "notice",
        relay: relay.url,
        notice,
      } as WorkerResponse)
    })

    // Connect to relays
    log("[Relay Worker] Connecting to relays...")
    await ndk.connect()

    log(`[Relay Worker] Initialized with ${ndk.pool?.relays.size || 0} relays`)

    // Signal ready
    self.postMessage({type: "ready"} as WorkerResponse)
  } catch (err) {
    error("[Relay Worker] Initialization failed:", err)
    self.postMessage({
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    } as WorkerResponse)
  }
}

function handleSubscribe(
  subId: string,
  filters: NDKFilter[],
  opts?: WorkerSubscribeOpts
) {
  if (!ndk) {
    error("[Relay Worker] NDK not initialized")
    return
  }

  // Clean up existing subscription with same ID
  if (subscriptions.has(subId)) {
    subscriptions.get(subId).stop()
  }

  const destinations = opts?.destinations || ["cache", "relay"]
  const cacheOnly = destinations.includes("cache") && !destinations.includes("relay")
  const relayOnly = destinations.includes("relay") && !destinations.includes("cache")

  let cacheUsage: NDKSubscriptionCacheUsage
  if (cacheOnly) {
    cacheUsage = NDKSubscriptionCacheUsage.ONLY_CACHE
  } else if (relayOnly) {
    cacheUsage = NDKSubscriptionCacheUsage.ONLY_RELAY
  } else {
    cacheUsage = NDKSubscriptionCacheUsage.PARALLEL
  }

  const sub = ndk.subscribe(filters, {
    closeOnEose: opts?.closeOnEose ?? cacheOnly,
    groupable: opts?.groupable ?? !cacheOnly,
    cacheUsage,
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

    // Auto-cleanup cache-only subs after EOSE
    if (cacheOnly) {
      subscriptions.delete(subId)
    }
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

async function handlePublish(
  id: string,
  eventData: any,
  relayUrls?: string[],
  opts?: WorkerPublishOpts
) {
  if (!ndk) {
    self.postMessage({
      type: "error",
      id,
      error: "NDK not initialized",
    } as WorkerResponse)
    return
  }

  try {
    const event = new NDKEvent(ndk, eventData)

    // Verify signature if requested (e.g., WebRTC events from untrusted sources)
    if (opts?.verifySignature) {
      const isValid = event.verifySignature(false)
      if (!isValid) {
        warn(
          "[Relay Worker] Invalid signature for event from:",
          opts.source,
          eventData.id
        )
        self.postMessage({
          type: "error",
          id,
          error: "Invalid signature",
        } as WorkerResponse)
        return
      }
    }

    const destinations = opts?.publishTo || ["relay"]

    // Dispatch to local subscriptions if requested
    if (destinations.includes("subscriptions")) {
      log(
        "[Relay Worker] Dispatching to subscriptions:",
        eventData.id,
        "source:",
        opts?.source
      )
      const fakeRelay = {url: opts?.source || "__local__"} as NDKRelay
      ndk.subManager.dispatchEvent(event, fakeRelay, false)
    }

    // Cache handled automatically by NDK cache adapter on dispatch

    // Publish to relays if requested
    if (!destinations.includes("relay")) {
      self.postMessage({
        type: "published",
        id,
      } as WorkerResponse)
      return
    }

    log("[Relay Worker] Publishing event:", eventData.id)

    // Publish to specified relays or all connected relays
    let relays: any = undefined
    if (relayUrls && relayUrls.length > 0) {
      relays = ndk.pool?.relays
        ? Array.from(ndk.pool.relays.values()).filter((r) => relayUrls.includes(r.url))
        : undefined
      log(
        "[Relay Worker] Publishing to specific relays:",
        relayUrls,
        "found:",
        relays?.length
      )
    } else {
      log("[Relay Worker] Publishing to all relays, pool size:", ndk.pool?.relays.size)
    }

    // Increase timeout to allow relays to connect (10s)
    await event.publish(relays, 10_000)

    log("[Relay Worker] Event published successfully:", eventData.id)
    self.postMessage({
      type: "published",
      id,
    } as WorkerResponse)
  } catch (err) {
    error("[Relay Worker] Publish failed:", err)
    self.postMessage({
      type: "error",
      id,
      error: err instanceof Error ? err.message : String(err),
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

function handleReconnectDisconnected(reason: string) {
  if (!ndk?.pool) return

  log(`[Relay Worker] ${reason}, checking relay connections...`)

  // Force immediate reconnection for disconnected relays
  // NDKRelayStatus: DISCONNECTED=1, RECONNECTING=2, FLAPPING=3, CONNECTING=4, CONNECTED=5+
  for (const relay of ndk.pool.relays.values()) {
    if (relay.status < 5) {
      log(`[Relay Worker] Forcing reconnection to ${relay.url} (status: ${relay.status})`)
      relay.connect()
    }
  }
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

// Listen for network status changes in worker
let wasOffline = false

self.addEventListener("online", () => {
  if (wasOffline) {
    log("[Relay Worker] Network connection restored")
    wasOffline = false
    handleReconnectDisconnected("Network connection restored")
  }
})

self.addEventListener("offline", () => {
  wasOffline = true
  log("[Relay Worker] Network connection lost")
})

// Message handler
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const data = e.data
  const {type, id, filters, event, relays, url, subscribeOpts, publishOpts} = data

  switch (type) {
    case "init":
      await initialize(relays)
      break

    case "subscribe":
      if (id && filters) {
        handleSubscribe(id, filters as NDKFilter[], subscribeOpts)
      }
      break

    case "unsubscribe":
      if (id) {
        handleUnsubscribe(id)
      }
      break

    case "publish":
      if (id && event) {
        await handlePublish(id, event, relays, publishOpts)
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

    case "reconnectDisconnected":
      handleReconnectDisconnected(data.reason || "Reconnect requested")
      break

    case "close":
      handleClose()
      break

    default:
      warn("[Relay Worker] Unknown message type:", type)
  }
}

// Handle errors
self.onerror = (err) => {
  error("[Relay Worker] Error:", err)
  self.postMessage({
    type: "error",
    error: err instanceof Error ? err.message : String(err),
  } as WorkerResponse)
}
