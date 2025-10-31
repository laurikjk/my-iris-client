import {NDKEvent} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {getAllConnections} from "./PeerConnection"
import {webrtcLogger} from "./Logger"

/**
 * Publishes event to both Nostr relays and WebRTC peers
 * Returns relay publish result
 */
export async function publishEvent(event: NDKEvent) {
  // Publish to relays
  const relayResult = await event.publish()

  // Send to WebRTC peers
  const connections = getAllConnections()
  const eventJson = event.rawEvent()

  if (!eventJson) {
    webrtcLogger.warn(undefined, "Cannot publish to peers: event not serialized")
    return relayResult
  }

  // NIP-01 format: ["EVENT", <event JSON>]
  const message = ["EVENT", eventJson]

  let sentCount = 0
  for (const [peerId, conn] of connections.entries()) {
    if (conn.dataChannel?.readyState === "open") {
      try {
        conn.sendJsonData(message)
        sentCount++
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

      const contentPreview =
        event.content && event.content.length > 50
          ? event.content.slice(0, 50) + "..."
          : event.content || ""
      webrtcLogger.info(
        peerId,
        `↓ kind ${event.kind} ${event.id?.slice(0, 8)} ${contentPreview}`
      )

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
