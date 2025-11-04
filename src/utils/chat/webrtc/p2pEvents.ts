import {NDKEvent, type NDKRawEvent} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {getAllConnections} from "./PeerConnection"
import {webrtcLogger} from "./Logger"
import socialGraph from "@/utils/socialGraph"
import {RateLimiter} from "./RateLimiter"
import {getCachedName} from "@/utils/nostr"
import {shouldHideUser} from "@/utils/visibility"
import {incrementSent, incrementReceived} from "./p2pStats"

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

/**
 * Send event to WebRTC peers
 */
export function sendEventToWebRTC(event: NDKEvent) {
  const connections = getAllConnections()
  const eventJson = event.rawEvent()

  if (!eventJson || !eventJson.id) {
    webrtcLogger.warn(undefined, "Cannot publish to peers: event not serialized")
    return
  }

  const isPrivateMessage = PRIVATE_MESSAGE_KINDS.includes(eventJson.kind)

  // NIP-01 format: ["EVENT", <event JSON>]
  const message = ["EVENT", eventJson]

  const sentToPeers: string[] = []
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
      incrementSent()
      // Mark as seen by this peer
      conn.seenEvents.set(eventJson.id, true)

      const peerPubkey = peerId.split(":")[0]
      const peerName = getCachedName(peerPubkey)
      sentToPeers.push(`${peerName} (${peerPubkey.slice(0, 8)})`)

      const contentPreview =
        eventJson.content && eventJson.content.length > 50
          ? eventJson.content.slice(0, 50) + "..."
          : eventJson.content || ""
      webrtcLogger.debug(
        peerId,
        `kind ${eventJson.kind} ${eventJson.id?.slice(0, 8)} ${contentPreview}`,
        "up"
      )
    } catch (error) {
      webrtcLogger.error(peerId, "Failed to send event")
    }
  }
}

/**
 * Relay handler that forwards events to WebRTC peers
 */
export function relayEventToWebRTC(event: NDKEvent) {
  const eventJson = event.rawEvent()
  if (!eventJson?.id) return

  // Only forward recent events (max 1 minute old)
  const now = Math.floor(Date.now() / 1000)
  const eventAge = now - (eventJson.created_at || 0)
  if (eventAge > 60) return

  const isPrivateMessage = PRIVATE_MESSAGE_KINDS.includes(eventJson.kind)
  const connections = getAllConnections()
  const message = ["EVENT", eventJson]
  const sentToPeers: string[] = []

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
      incrementSent()

      const peerPubkey = peerId.split(":")[0]
      const peerName = getCachedName(peerPubkey)
      sentToPeers.push(`${peerName} (${peerPubkey.slice(0, 8)})`)

      const contentPreview =
        eventJson.content && eventJson.content.length > 50
          ? eventJson.content.slice(0, 50) + "..."
          : eventJson.content || ""
      webrtcLogger.debug(
        peerId,
        `relayed kind ${eventJson.kind} ${eventJson.id.slice(0, 8)} ${contentPreview}`,
        "up"
      )
    } catch (error) {
      webrtcLogger.error(peerId, "Failed to relay event")
    }
  }
}

/**
 * Handle incoming EVENT message from WebRTC peer
 */
export function handleIncomingEventMessage(
  peerId: string,
  eventJson: unknown
): NDKEvent | null {
  const ndkInstance = ndk()
  const event = new NDKEvent(ndkInstance, eventJson as Partial<NDKRawEvent>)

  // Rate limit only private messages from unknown senders
  const isPrivateMessage = PRIVATE_MESSAGE_KINDS.includes(event.kind || 0)
  if (isPrivateMessage) {
    const followDistance = socialGraph().getFollowDistance(event.pubkey)
    if (followDistance > 2) {
      if (!incomingRateLimiter.check(peerId)) {
        webrtcLogger.warn(
          peerId,
          `Rate limit exceeded for kind ${event.kind} from unknown sender`
        )
        return null
      }
    }
  }

  // Verify signature (also validates event structure)
  const isValid = event.verifySignature(false)
  if (!isValid) {
    webrtcLogger.warn(peerId, `Invalid signature ${event.id?.slice(0, 8)}`, "down")
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
  const peerPubkey = peerId.split(":")[0]
  const authorName = getCachedName(event.pubkey)
  const authorInfo =
    peerPubkey === event.pubkey
      ? ""
      : ` author: ${authorName} (${event.pubkey.slice(0, 8)})`
  webrtcLogger.debug(
    peerId,
    `kind ${event.kind}${authorInfo} ${event.id?.slice(0, 8)} ${contentPreview}`,
    "down"
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
          webrtcLogger.error(otherPeerId, "Failed to forward event")
        }
      }
    }

    if (forwardCount > 0) {
      webrtcLogger.debug(undefined, `↻ Forwarded event to ${forwardCount} peer(s)`)
    }
  }

  // Publish to our relays for backup and cross-device sync
  // Silently fail if no relays connected
  event.publish().catch(() => {})

  return event
}
