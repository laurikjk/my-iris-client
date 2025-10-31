import {NDKEvent} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {getAllConnections} from "./PeerConnection"
import {webrtcLogger} from "./Logger"
import localforage from "localforage"

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
 * Publishes event to both Nostr relays and WebRTC peers
 * Returns relay publish result
 */
export async function publishEvent(event: NDKEvent) {
  // Publish to relays (silently ignore relay failures)
  let relayResult
  try {
    relayResult = await event.publish()
  } catch (error) {
    // Ignore relay errors - we still want to send via WebRTC
  }

  // Send to WebRTC peers
  const connections = getAllConnections()
  const eventJson = event.rawEvent()

  if (!eventJson || !eventJson.id) {
    webrtcLogger.warn(undefined, "Cannot publish to peers: event not serialized")
    return relayResult
  }

  // NIP-01 format: ["EVENT", <event JSON>]
  const message = ["EVENT", eventJson]

  let sentCount = 0
  for (const [peerId, conn] of connections.entries()) {
    if (conn.dataChannel?.readyState === "open") {
      // Skip if peer has already seen this event
      if (conn.seenEvents.has(eventJson.id)) {
        continue
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
        webrtcLogger.info(
          peerId,
          `↑ kind ${eventJson.kind} ${eventJson.id?.slice(0, 8)} ${contentPreview}`
        )
      } catch (error) {
        webrtcLogger.error(peerId, "Failed to send event", error)
      }
    }
  }

  if (sentCount > 0) {
    webrtcLogger.info(
      undefined,
      `↑ Published event ${eventJson.id?.slice(0, 8)} to ${sentCount} peer(s)`
    )
  }

  return relayResult
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
      webrtcLogger.info(
        peerId,
        `↓ kind ${event.kind} ${event.id?.slice(0, 8)} ${contentPreview}`
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
