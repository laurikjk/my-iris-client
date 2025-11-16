import NDK, {
  NDKEvent,
  type NDKFilter,
  type NDKRelay,
  type NDKSubscription,
} from "@/lib/ndk"
import type {NDKTransportPlugin} from "@/lib/ndk-transport-plugin"
import {
  mergeFilters,
  filterFingerprint,
  type NDKFilterFingerprint,
} from "@/lib/ndk/subscription/grouping"
import {getAllConnections} from "./PeerConnection"
import {createDebugLogger} from "@/utils/createDebugLogger"
import {DEBUG_NAMESPACES} from "@/utils/constants"
import socialGraph from "@/utils/socialGraph"

const {log, warn, error} = createDebugLogger(DEBUG_NAMESPACES.WEBRTC_PEER)
import {RateLimiter} from "./RateLimiter"
import {getCachedName} from "@/utils/nostr"
import {shouldHideUser} from "@/utils/visibility"
import {incrementSent, incrementReceived, incrementSubscriptionsServed} from "./p2pStats"
import {trackPeerEventSent, trackPeerEventReceived} from "./peerBandwidthStats"

// Event kinds that bypass follow check but are rate limited
const PRIVATE_MESSAGE_KINDS = [1059, 1060] // INVITE_RESPONSE, MESSAGE_EVENT

// Rate limiters: 5 events per second per peer
const incomingRateLimiter = new RateLimiter(5, 1000)
const outgoingRateLimiter = new RateLimiter(5, 1000)
const incomingSubRateLimiter = new RateLimiter(5, 1000)

// Subscription grouping delay
const GROUPING_DELAY = 200 // ms

type FilterGroup = {
  filters: NDKFilter[]
  timeout: NodeJS.Timeout
}

const filterGroups = new Map<NDKFilterFingerprint, FilterGroup>()
const recentSubs = new Map<NDKFilterFingerprint, number>()
const SUB_DEDUPE_WINDOW = 5000

// Cleanup intervals
setInterval(() => {
  incomingRateLimiter.cleanup()
  outgoingRateLimiter.cleanup()
  incomingSubRateLimiter.cleanup()
}, 5000)

setInterval(() => {
  const now = Date.now()
  for (const [hash, timestamp] of recentSubs.entries()) {
    if (now - timestamp > SUB_DEDUPE_WINDOW) {
      recentSubs.delete(hash)
    }
  }
}, 10000)

function sendGroupedFilters(groupKey: NDKFilterFingerprint) {
  const group = filterGroups.get(groupKey)
  if (!group) return

  filterGroups.delete(groupKey)

  // Merge filters using NDK's logic
  const merged = mergeFilters(group.filters)

  const subId =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  const connections = getAllConnections()
  const message = ["REQ", subId, ...merged]

  for (const conn of connections.values()) {
    if (conn.dataChannel?.readyState !== "open") continue

    try {
      conn.sendJsonData(message)
      const filterStr = JSON.stringify(merged).slice(0, 200)
      log(`REQ ${subId} ${filterStr}`)
    } catch (err) {
      error("Failed to send subscription")
    }
  }
}

/**
 * WebRTC Transport Plugin for NDK
 * Provides peer-to-peer event distribution over WebRTC data channels
 */
export class WebRTCTransportPlugin implements NDKTransportPlugin {
  readonly name = "webrtc"
  public ndk?: NDK

  initialize(ndk: NDK): void {
    this.ndk = ndk
    log("WebRTC transport plugin initialized")
  }

  /**
   * Forward published events to WebRTC peers
   */
  async onPublish(event: NDKEvent): Promise<void> {
    const connections = getAllConnections()
    const eventJson = event.rawEvent()

    if (!eventJson || !eventJson.id) {
      warn("Cannot publish to peers: event not serialized")
      return
    }

    const isPrivateMessage = PRIVATE_MESSAGE_KINDS.includes(eventJson.kind)
    const message = ["EVENT", eventJson]

    for (const [peerId, conn] of connections.entries()) {
      if (conn.dataChannel?.readyState !== "open") continue

      // Skip if peer has already seen this event
      if (conn.seenEvents.has(eventJson.id)) continue

      // Private messages: rate limit but don't check follows
      if (isPrivateMessage) {
        if (!outgoingRateLimiter.check(peerId)) {
          warn(`Rate limit exceeded for kind ${eventJson.kind}`)
          continue
        }
      } else {
        // Public messages: check follow distance <= 2 and not hidden
        const followDistance = socialGraph().getFollowDistance(eventJson.pubkey)
        if (followDistance > 2) continue
        if (shouldHideUser(eventJson.pubkey, 1, true)) continue
      }

      try {
        const messageStr = JSON.stringify(message)
        const peerPubkey = peerId.split(":")[0]
        conn.sendJsonData(message)
        incrementSent(messageStr.length)
        trackPeerEventSent(peerPubkey, messageStr.length)
        conn.seenEvents.set(eventJson.id, true)

        const contentPreview =
          eventJson.content && eventJson.content.length > 50
            ? eventJson.content.slice(0, 50) + "..."
            : eventJson.content || ""
        log(`EVENT kind ${eventJson.kind} ${eventJson.id?.slice(0, 8)} ${contentPreview}`)
      } catch (err) {
        error("Failed to send event")
      }
    }
  }

  /**
   * Send subscription requests to WebRTC peers
   * NDK has already decided this subscription should use WebRTC
   */
  onSubscribe(subscription: NDKSubscription, filters: NDKFilter[]): void {
    this.sendToWebRTC(filters)

    // Attach event listener to forward relay events to peers
    subscription.on("event", (event: NDKEvent) => {
      this.relayEventToWebRTC(event)
    })
  }

  /**
   * Send filters to WebRTC peers with batching
   */
  private sendToWebRTC(filters: NDKFilter[]): void {
    // Use NDK's fingerprint for grouping
    const fingerprint = filterFingerprint(filters, false)
    if (!fingerprint) {
      // Non-groupable filters, send immediately
      const subId =
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15)
      const connections = getAllConnections()
      const message = ["REQ", subId, ...filters]

      for (const conn of connections.values()) {
        if (conn.dataChannel?.readyState !== "open") continue
        try {
          conn.sendJsonData(message)
          const filterStr = JSON.stringify(filters).slice(0, 200)
          log(`REQ ${subId} ${filterStr}`)
        } catch (err) {
          error("Failed to send subscription")
        }
      }
      return
    }

    // Check if we sent this fingerprint recently (avoid loops)
    const lastSent = recentSubs.get(fingerprint)
    if (lastSent && Date.now() - lastSent < SUB_DEDUPE_WINDOW) {
      return
    }
    recentSubs.set(fingerprint, Date.now())

    const existing = filterGroups.get(fingerprint)
    if (existing) {
      existing.filters.push(...filters)
      clearTimeout(existing.timeout)
      existing.timeout = setTimeout(() => sendGroupedFilters(fingerprint), GROUPING_DELAY)
    } else {
      const timeout = setTimeout(() => sendGroupedFilters(fingerprint), GROUPING_DELAY)
      filterGroups.set(fingerprint, {filters: [...filters], timeout})
    }
  }

  /**
   * Close subscription on WebRTC peers
   */
  onUnsubscribe(subId: string): void {
    const connections = getAllConnections()
    const message = ["CLOSE", subId]

    for (const conn of connections.values()) {
      if (conn.dataChannel?.readyState !== "open") continue

      try {
        conn.sendJsonData(message)
        log(`CLOSE ${subId}`)
      } catch (err) {
        error("Failed to close subscription")
      }
    }
  }

  /**
   * Forward relay events to WebRTC peers
   */
  private relayEventToWebRTC(event: NDKEvent): void {
    const eventJson = event.rawEvent()
    if (!eventJson?.id) return

    // Only forward recent events (max 1 minute old)
    const now = Math.floor(Date.now() / 1000)
    const eventAge = now - (eventJson.created_at || 0)
    if (eventAge > 60) return

    const isPrivateMessage = PRIVATE_MESSAGE_KINDS.includes(eventJson.kind)
    const connections = getAllConnections()
    const message = ["EVENT", eventJson]

    for (const [peerId, conn] of connections.entries()) {
      if (conn.dataChannel?.readyState !== "open") continue
      if (conn.seenEvents.has(eventJson.id)) continue

      if (isPrivateMessage) {
        if (!outgoingRateLimiter.check(peerId)) {
          warn(`Rate limit exceeded for kind ${eventJson.kind}`)
          continue
        }
      } else {
        const followDistance = socialGraph().getFollowDistance(eventJson.pubkey)
        if (followDistance > 2) continue
        if (shouldHideUser(eventJson.pubkey, 1, true)) continue
      }

      try {
        const messageStr = JSON.stringify(message)
        const peerPubkey = peerId.split(":")[0]
        conn.sendJsonData(message)
        incrementSent(messageStr.length)
        trackPeerEventSent(peerPubkey, messageStr.length)
        conn.seenEvents.set(eventJson.id, true)

        const contentPreview =
          eventJson.content && eventJson.content.length > 50
            ? eventJson.content.slice(0, 50) + "..."
            : eventJson.content || ""
        log(
          `EVENT relayed kind ${eventJson.kind} ${eventJson.id.slice(0, 8)} ${contentPreview}`
        )
      } catch (err) {
        error("Failed to relay event")
      }
    }
  }

  /**
   * Handle incoming EVENT message from WebRTC peer
   * Called by p2pMessages when EVENT is received
   */
  async handleIncomingEvent(
    peerId: string,
    eventJson: unknown
  ): Promise<NDKEvent | null> {
    if (!this.ndk) return null

    const event = new NDKEvent(this.ndk, eventJson as Record<string, unknown>)

    if (!event.id) {
      warn("Event missing ID")
      return null
    }

    // Rate limit only private messages from unknown senders
    const isPrivateMessage = PRIVATE_MESSAGE_KINDS.includes(event.kind || 0)
    if (isPrivateMessage) {
      const followDistance = socialGraph().getFollowDistance(event.pubkey)
      if (followDistance > 2) {
        if (!incomingRateLimiter.check(peerId)) {
          warn(`Rate limit exceeded for kind ${event.kind} from unknown sender`)
          return null
        }
      }
    }

    // Verify signature
    const isValid = event.verifySignature(false)
    if (!isValid) {
      warn(`Invalid signature ${event.id?.slice(0, 8)}`)
      return null
    }

    const eventSize = JSON.stringify(event.rawEvent()).length
    const peerPubkey = peerId.split(":")[0]
    incrementReceived(eventSize)
    trackPeerEventReceived(peerPubkey, eventSize)

    const contentPreview =
      event.content && event.content.length > 50
        ? event.content.slice(0, 50) + "..."
        : event.content || ""
    const authorName = getCachedName(event.pubkey)
    const authorInfo =
      peerPubkey === event.pubkey
        ? ""
        : ` author: ${authorName} (${event.pubkey.slice(0, 8)})`
    log(
      `EVENT kind ${event.kind}${authorInfo} ${event.id?.slice(0, 8)} ${contentPreview}`
    )

    // Mark event as seen by sender and track in manager with WebRTC origin
    const senderConn = getAllConnections().get(peerId)
    if (senderConn) {
      senderConn.seenEvents.set(event.id, true)
    }

    // Create fake relay object for WebRTC tracking
    const webrtcRelay = {url: `__webrtc__:${peerId}`} as NDKRelay

    // Forward to other peers who haven't seen it
    const connections = getAllConnections()
    const forwardEventJson = event.rawEvent()
    if (forwardEventJson) {
      const message = ["EVENT", forwardEventJson]
      let forwardCount = 0

      for (const [otherPeerId, conn] of connections.entries()) {
        if (otherPeerId === peerId || conn.seenEvents.has(event.id)) {
          continue
        }

        if (conn.dataChannel?.readyState === "open") {
          try {
            conn.sendJsonData(message)
            conn.seenEvents.set(event.id, true)
            forwardCount++
          } catch (err) {
            error("Failed to forward event")
          }
        }
      }

      if (forwardCount > 0) {
        log(`↻ Forwarded event to ${forwardCount} peer(s)`)
      }
    }

    // Route to worker transport if available, otherwise local dispatch
    const {getWorkerTransport} = await import("@/utils/ndk")
    const workerTransport = getWorkerTransport()

    if (workerTransport) {
      // Inject into worker for dispatch + cache (no relay publish)
      workerTransport.injectEvent(event.rawEvent(), `webrtc:${peerId}`)
    } else {
      // Fallback: dispatch locally (legacy path)
      this.ndk.subManager.dispatchEvent(event, webrtcRelay, false)
    }

    return event
  }

  /**
   * Handle incoming REQ message from WebRTC peer
   * Called by p2pMessages when REQ is received
   */
  handleIncomingREQ(peerId: string, subId: string, filters: unknown[]): void {
    if (!this.ndk) return

    const filterStr = JSON.stringify(filters).slice(0, 200)
    log(`REQ ${subId} ${filterStr}`)

    // Rate limit incoming subscriptions
    if (!incomingSubRateLimiter.check(peerId)) {
      warn(`Rate limit exceeded for incoming REQ`)
      return
    }

    incrementSubscriptionsServed()

    const peerConn = getAllConnections().get(peerId)
    if (!peerConn) return

    // Query each filter separately with reasonable limit
    for (const filter of filters as NDKFilter[]) {
      const limitedFilter = {...filter, limit: Math.min(filter.limit || 100, 100)}
      this.ndk
        .fetchEvents(limitedFilter)
        .then((events) => {
          let sentCount = 0
          for (const event of events) {
            if (!event.id) continue
            if (peerConn.seenEvents.has(event.id)) continue

            const eventJson = event.rawEvent()
            if (!eventJson) continue

            const message = ["EVENT", subId, eventJson]
            try {
              peerConn.sendJsonData(message)
              peerConn.seenEvents.set(event.id, true)
              sentCount++
            } catch (err) {
              error("Failed to send cached event")
            }
          }

          if (sentCount > 0) {
            log(`Sent ${sentCount} cached event(s) for ${subId}`)
          }

          // Send EOSE
          try {
            peerConn.sendJsonData(["EOSE", subId])
            log(`EOSE ${subId}`)
          } catch (err) {
            error("Failed to send EOSE")
          }
        })
        .catch(() => {
          error("Failed to fetch cached events")
        })
    }
  }

  destroy(): void {
    // Clear any pending filter groups
    for (const group of filterGroups.values()) {
      clearTimeout(group.timeout)
    }
    filterGroups.clear()
    recentSubs.clear()

    log("WebRTC transport plugin destroyed")
  }
}
