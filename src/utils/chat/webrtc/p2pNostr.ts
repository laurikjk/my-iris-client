import {NDKEvent, type NDKFilter, NDKRelaySet} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {getAllConnections} from "./PeerConnection"
import {webrtcLogger} from "./Logger"
import localforage from "localforage"
import socialGraph from "@/utils/socialGraph"
import {RateLimiter} from "./RateLimiter"
import {getCachedName} from "@/utils/nostr"
import {useSettingsStore} from "@/stores/settings"
import {KIND_APP_DATA} from "@/utils/constants"
import {shouldHideUser} from "@/utils/visibility"

// Event kinds that bypass follow check but are rate limited
const PRIVATE_MESSAGE_KINDS = [1059, 1060] // INVITE_RESPONSE, MESSAGE_EVENT

// Rate limiters: 5 events per second per peer
const incomingRateLimiter = new RateLimiter(5, 1000)
const outgoingRateLimiter = new RateLimiter(5, 1000)

// Cleanup rate limiters every 5 seconds
setInterval(() => {
  incomingRateLimiter.cleanup()
  outgoingRateLimiter.cleanup()
}, 5000)

// Stats storage
const statsStore = localforage.createInstance({
  name: "iris",
  storeName: "webrtc-stats",
})

interface P2PStats {
  eventsSent: number
  eventsReceived: number
}

async function getStats(): Promise<P2PStats> {
  const stats = await statsStore.getItem<P2PStats>("p2p-stats")
  return stats || {eventsSent: 0, eventsReceived: 0}
}

async function incrementSent() {
  const stats = await getStats()
  stats.eventsSent++
  await statsStore.setItem("p2p-stats", stats)
}

async function incrementReceived() {
  const stats = await getStats()
  stats.eventsReceived++
  await statsStore.setItem("p2p-stats", stats)
}

export async function getP2PStats(): Promise<P2PStats> {
  return getStats()
}

export async function resetP2PStats() {
  await statsStore.setItem("p2p-stats", {eventsSent: 0, eventsReceived: 0})
}

/**
 * Send event to WebRTC peers
 */
function sendEventToWebRTC(event: NDKEvent) {
  const connections = getAllConnections()
  const eventJson = event.rawEvent()

  if (!eventJson || !eventJson.id) {
    webrtcLogger.warn(undefined, "Cannot publish to peers: event not serialized")
    return
  }

  const isPrivateMessage = PRIVATE_MESSAGE_KINDS.includes(eventJson.kind)

  // NIP-01 format: ["EVENT", <event JSON>]
  const message = ["EVENT", eventJson]

  let sentCount = 0
  for (const [peerId, conn] of connections.entries()) {
    if (conn.dataChannel?.readyState !== "open") continue

    // Skip if peer has already seen this event
    if (conn.seenEvents.has(eventJson.id)) continue

    // Private messages: rate limit but don't check follows
    if (isPrivateMessage) {
      if (!outgoingRateLimiter.check(peerId)) {
        webrtcLogger.warn(peerId, `Rate limit exceeded for kind ${eventJson.kind}`)
        continue
      }
    } else {
      // Public messages: check follow distance <= 2 and not hidden
      const followDistance = socialGraph().getFollowDistance(eventJson.pubkey)
      if (followDistance > 2) continue
      if (shouldHideUser(eventJson.pubkey, 1, true)) continue
    }

    try {
      conn.sendJsonData(message)
      sentCount++
      incrementSent()
      // Mark as seen by this peer
      conn.seenEvents.set(eventJson.id, true)

      const contentPreview =
        eventJson.content && eventJson.content.length > 50
          ? eventJson.content.slice(0, 50) + "..."
          : eventJson.content || ""
      const authorName = getCachedName(eventJson.pubkey)
      webrtcLogger.debug(
        peerId,
        `↑ kind ${eventJson.kind} from ${authorName} (${eventJson.pubkey.slice(0, 8)}) ${eventJson.id?.slice(0, 8)} ${contentPreview}`
      )
    } catch (error) {
      webrtcLogger.error(peerId, "Failed to send event", error)
    }
  }

  if (sentCount > 0) {
    webrtcLogger.info(
      undefined,
      `↑ Published event ${eventJson.id?.slice(0, 8)} to ${sentCount} peer(s)`
    )
  }
}

/**
 * Wrap NDK publish to include WebRTC forwarding
 */
export function wrapNDKPublish() {
  const originalPublish = NDKEvent.prototype.publish
  NDKEvent.prototype.publish = async function (...args) {
    // Publish to relays normally
    const result = await originalPublish.apply(this, args)

    // Send to WebRTC peers
    sendEventToWebRTC(this)

    return result
  }
}

/**
 * Relay handler that forwards events to WebRTC peers
 */
function relayEventToWebRTC(event: NDKEvent) {
  const eventJson = event.rawEvent()
  if (!eventJson?.id) return

  // Only forward recent events (max 1 minute old)
  const now = Math.floor(Date.now() / 1000)
  const eventAge = now - (eventJson.created_at || 0)
  if (eventAge > 60) return

  const isPrivateMessage = PRIVATE_MESSAGE_KINDS.includes(eventJson.kind)
  const connections = getAllConnections()
  const message = ["EVENT", eventJson]
  let sentCount = 0

  for (const [peerId, conn] of connections.entries()) {
    // Skip if channel not open
    if (conn.dataChannel?.readyState !== "open") continue

    // Skip if peer already saw this
    if (conn.seenEvents.has(eventJson.id)) continue

    // Private messages: rate limit but don't check follows (might be recipient)
    if (isPrivateMessage) {
      if (!outgoingRateLimiter.check(peerId)) {
        webrtcLogger.warn(peerId, `Rate limit exceeded for kind ${eventJson.kind}`)
        continue
      }
    } else {
      // Public messages: check follow distance <= 2 and not hidden
      const followDistance = socialGraph().getFollowDistance(eventJson.pubkey)
      if (followDistance > 2) continue
      if (shouldHideUser(eventJson.pubkey, 1, true)) continue
    }

    try {
      conn.sendJsonData(message)
      conn.seenEvents.set(eventJson.id, true)
      sentCount++
      incrementSent()

      const contentPreview =
        eventJson.content && eventJson.content.length > 50
          ? eventJson.content.slice(0, 50) + "..."
          : eventJson.content || ""
      const authorName = getCachedName(eventJson.pubkey)
      webrtcLogger.debug(
        peerId,
        `↑ relayed kind ${eventJson.kind} from ${authorName} (${eventJson.pubkey.slice(0, 8)}) ${eventJson.id.slice(0, 8)} ${contentPreview}`
      )
    } catch (error) {
      webrtcLogger.error(peerId, "Failed to relay event", error)
    }
  }

  if (sentCount > 0) {
    webrtcLogger.info(
      undefined,
      `↑ Relayed event ${eventJson.id.slice(0, 8)} to ${sentCount} peer(s)`
    )
  }
}

/**
 * Check if subscription filter is for WebRTC signaling
 */
function isSignalingSubscription(filters: NDKFilter | NDKFilter[]): boolean {
  const filterArray = Array.isArray(filters) ? filters : [filters]
  return filterArray.some(
    (filter) => filter.kinds?.includes(KIND_APP_DATA) && filter["#l"]?.includes("webrtc")
  )
}

/**
 * Hook into all NDK subscriptions to relay events to WebRTC peers
 */
export function wrapNDKSubscribe() {
  const ndkInstance = ndk()

  // Wrap subscribe to attach our relay handler to all subscriptions
  const originalSubscribe = ndkInstance.subscribe.bind(ndkInstance)
  ndkInstance.subscribe = (...args) => {
    const p2pOnlyMode = useSettingsStore.getState().network.p2pOnlyMode
    const [filters] = args

    // In P2P-only mode, only subscribe to signaling events on relays
    if (p2pOnlyMode && !isSignalingSubscription(filters)) {
      webrtcLogger.debug(undefined, "P2P-only mode: skipping relay subscription")
      // Create subscription with empty relay set (no relay traffic)
      const emptyRelaySet = new NDKRelaySet(new Set(), ndkInstance)
      const subscription = originalSubscribe(filters, {closeOnEose: false}, emptyRelaySet)
      subscription.on("event", relayEventToWebRTC)
      return subscription
    }

    const subscription = originalSubscribe(...args)
    subscription.on("event", relayEventToWebRTC)
    return subscription
  }
}

/**
 * Initialize WebRTC integration with NDK
 * Wraps publish and subscribe methods to include WebRTC forwarding
 */
export function initializeWebRTCIntegration() {
  wrapNDKPublish()
  wrapNDKSubscribe()
}

/**
 * Handles incoming Nostr event from WebRTC peer
 * Saves to NDK cache
 */
export function handleIncomingEvent(peerId: string, eventData: unknown): NDKEvent | null {
  try {
    if (!Array.isArray(eventData)) {
      webrtcLogger.warn(peerId, "Invalid Nostr message format")
      return null
    }

    const [type, ...rest] = eventData

    // Handle ["EVENT", <event JSON>] format
    if (type === "EVENT" && rest.length >= 1) {
      // Client format: ["EVENT", <event>]
      // Relay format: ["EVENT", <subscription_id>, <event>]
      const eventJson = rest.length === 1 ? rest[0] : rest[1]

      // Rate limit incoming events from this peer
      if (!incomingRateLimiter.check(peerId)) {
        webrtcLogger.warn(peerId, `Rate limit exceeded for incoming event`)
        return null
      }

      const ndkInstance = ndk()
      const event = new NDKEvent(ndkInstance, eventJson)

      // Verify signature
      const isValid = event.verifySignature(false)
      if (!isValid) {
        webrtcLogger.warn(peerId, `↓ Invalid signature ${event.id?.slice(0, 8)}`)
        return null
      }

      if (!event.id) {
        webrtcLogger.warn(peerId, "Event missing ID")
        return null
      }

      // Check if we've already seen this event
      if (ndkInstance.subManager.seenEvents.has(event.id)) {
        // Already have this event, just mark as seen by sender
        const senderConn = getAllConnections().get(peerId)
        if (senderConn) {
          senderConn.seenEvents.set(event.id, true)
        }
        return null
      }

      incrementReceived()

      const contentPreview =
        event.content && event.content.length > 50
          ? event.content.slice(0, 50) + "..."
          : event.content || ""
      const authorName = getCachedName(event.pubkey)
      webrtcLogger.debug(
        peerId,
        `↓ kind ${event.kind} from ${authorName} (${event.pubkey.slice(0, 8)}) ${event.id?.slice(0, 8)} ${contentPreview}`
      )

      // Mark event as seen by sender
      const senderConn = getAllConnections().get(peerId)
      if (senderConn) {
        senderConn.seenEvents.set(event.id, true)
      }

      // Forward to other peers who haven't seen it
      const connections = getAllConnections()
      const forwardEventJson = event.rawEvent()
      if (forwardEventJson) {
        const message = ["EVENT", forwardEventJson]
        let forwardCount = 0

        for (const [otherPeerId, conn] of connections.entries()) {
          // Skip sender and check if already seen
          if (otherPeerId === peerId || conn.seenEvents.has(event.id)) {
            continue
          }

          if (conn.dataChannel?.readyState === "open") {
            try {
              conn.sendJsonData(message)
              conn.seenEvents.set(event.id, true)
              forwardCount++
            } catch (error) {
              webrtcLogger.error(otherPeerId, "Failed to forward event", error)
            }
          }
        }

        if (forwardCount > 0) {
          webrtcLogger.info(undefined, `↻ Forwarded event to ${forwardCount} peer(s)`)
        }
      }

      // Publish to our relays for backup and cross-device sync
      // Silently fail if no relays connected
      event.publish().catch(() => {})

      return event
    }

    webrtcLogger.warn(peerId, `Unsupported message type: ${type}`)
    return null
  } catch (error) {
    webrtcLogger.error(peerId, "Error handling incoming event", error)
    return null
  }
}
