import {NDKEvent} from "@nostr-dev-kit/ndk"
import {webrtcLogger} from "./Logger"
import {handleIncomingEventMessage} from "./p2pEvents"
import {
  handleIncomingREQ,
  handleIncomingEOSE,
  handleIncomingCLOSE,
} from "./p2pSubscriptions"

/**
 * Handles incoming Nostr message from WebRTC peer
 * Supports EVENT, REQ, EOSE, and CLOSE message types
 */
export function handleIncomingMessage(
  peerId: string,
  eventData: unknown
): NDKEvent | null {
  try {
    if (!Array.isArray(eventData)) {
      webrtcLogger.warn(peerId, "Invalid Nostr message format")
      return null
    }

    const [type, ...rest] = eventData

    // Handle ["REQ", subscription_id, ...filters] format
    if (type === "REQ" && rest.length >= 2) {
      const [subId, ...filters] = rest
      handleIncomingREQ(peerId, subId, filters)
      return null
    }

    // Handle ["EVENT", <event JSON>] format
    if (type === "EVENT" && rest.length >= 1) {
      // Client format: ["EVENT", <event>]
      // Relay format: ["EVENT", <subscription_id>, <event>]
      const eventJson = rest.length === 1 ? rest[0] : rest[1]
      return handleIncomingEventMessage(peerId, eventJson)
    }

    // Handle ["EOSE", subscription_id] format
    if (type === "EOSE" && rest.length >= 1) {
      const [subId] = rest
      handleIncomingEOSE(peerId, subId)
      return null
    }

    // Handle ["CLOSE", subscription_id] format
    if (type === "CLOSE" && rest.length >= 1) {
      const [subId] = rest
      handleIncomingCLOSE(peerId, subId)
      return null
    }

    webrtcLogger.warn(peerId, `Unsupported message type: ${type}`)
    return null
  } catch (error) {
    webrtcLogger.error(peerId, "Error handling incoming message", error)
    return null
  }
}
