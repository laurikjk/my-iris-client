import {NDKEvent, type NDKRelay} from "@/lib/ndk"
import {webrtcLogger} from "./Logger"
import {getAllConnections} from "./PeerConnection"
import type {WebRTCTransportPlugin} from "./WebRTCTransportPlugin"

let webrtcPlugin: WebRTCTransportPlugin | null = null

/**
 * Set the WebRTC plugin instance (called during initialization)
 */
export function setWebRTCPlugin(plugin: WebRTCTransportPlugin): void {
  webrtcPlugin = plugin
}

/**
 * Get the WebRTC plugin instance
 */
export function getWebRTCPlugin(): WebRTCTransportPlugin | null {
  return webrtcPlugin
}

/**
 * Extract event ID from WebRTC message string without full JSON parse.
 * Returns event ID if message is EVENT type, null otherwise.
 */
function getEventIdFromMessage(msg: string): string | null {
  // Fast check: msg starts with ["EVENT"
  if (msg.charCodeAt(2) !== 69 || msg.charCodeAt(3) !== 86) {
    return null
  }
  const idPos = msg.indexOf('"id":"')
  if (idPos === -1) {
    return null
  }
  // Extract 64 chars after "id":"
  return msg.substring(idPos + 6, idPos + 70)
}

/**
 * Handles incoming Nostr message from WebRTC peer
 * Supports EVENT, REQ, EOSE, and CLOSE message types
 */
export async function handleIncomingMessage(
  peerId: string,
  messageData: string
): Promise<void> {
  const plugin = getWebRTCPlugin()
  if (!plugin) {
    webrtcLogger.warn(peerId, "WebRTC plugin not initialized")
    return
  }

  try {
    // Early dedup check before JSON.parse
    const eventId = getEventIdFromMessage(messageData)
    if (eventId && plugin.ndk) {
      const seenData = plugin.ndk.subManager.seenEvents.get(eventId)
      if (seenData?.processedEvent) {
        // Already processed, mark peer as seen and dispatch to subs
        const senderConn = getAllConnections().get(peerId)
        if (senderConn) {
          senderConn.seenEvents.set(eventId, true)
        }
        // Track this peer also saw it
        const webrtcRelay = {url: `__webrtc__:${peerId}`} as NDKRelay
        plugin.ndk.subManager.dispatchEvent(seenData.processedEvent, webrtcRelay, false)
        return
      }
    }

    const eventData = JSON.parse(messageData)

    if (!Array.isArray(eventData)) {
      webrtcLogger.warn(peerId, "Invalid Nostr message format")
      return
    }

    const [type, ...rest] = eventData

    // Handle ["REQ", subscription_id, ...filters] format
    if (type === "REQ" && rest.length >= 2) {
      const [subId, ...filters] = rest
      plugin.handleIncomingREQ(peerId, subId, filters)
      return
    }

    // Handle ["EVENT", <event JSON>] format
    if (type === "EVENT" && rest.length >= 1) {
      // Client format: ["EVENT", <event>]
      // Relay format: ["EVENT", <subscription_id>, <event>]
      const eventJson = rest.length === 1 ? rest[0] : rest[1]
      await plugin.handleIncomingEvent(peerId, eventJson)
      return
    }

    // Handle ["EOSE", subscription_id] format
    if (type === "EOSE" && rest.length >= 1) {
      const [subId] = rest
      webrtcLogger.debug(peerId, `EOSE ${subId}`, "down")
      return
    }

    // Handle ["CLOSE", subscription_id] format
    if (type === "CLOSE" && rest.length >= 1) {
      const [subId] = rest
      webrtcLogger.debug(peerId, `CLOSE ${subId}`, "down")
      return
    }

    webrtcLogger.warn(peerId, `Unsupported message type: ${type}`)
  } catch (error) {
    webrtcLogger.error(peerId, "Error handling incoming message")
  }
}
