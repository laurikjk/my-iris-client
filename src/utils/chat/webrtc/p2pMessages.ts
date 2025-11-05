import {NDKEvent} from "@/lib/ndk"
import {webrtcLogger} from "./Logger"
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
 * Handles incoming Nostr message from WebRTC peer
 * Supports EVENT, REQ, EOSE, and CLOSE message types
 */
export function handleIncomingMessage(
  peerId: string,
  eventData: unknown
): NDKEvent | null {
  const plugin = getWebRTCPlugin()
  if (!plugin) {
    webrtcLogger.warn(peerId, "WebRTC plugin not initialized")
    return null
  }

  try {
    if (!Array.isArray(eventData)) {
      webrtcLogger.warn(peerId, "Invalid Nostr message format")
      return null
    }

    const [type, ...rest] = eventData

    // Handle ["REQ", subscription_id, ...filters] format
    if (type === "REQ" && rest.length >= 2) {
      const [subId, ...filters] = rest
      plugin.handleIncomingREQ(peerId, subId, filters)
      return null
    }

    // Handle ["EVENT", <event JSON>] format
    if (type === "EVENT" && rest.length >= 1) {
      // Client format: ["EVENT", <event>]
      // Relay format: ["EVENT", <subscription_id>, <event>]
      const eventJson = rest.length === 1 ? rest[0] : rest[1]
      return plugin.handleIncomingEvent(peerId, eventJson)
    }

    // Handle ["EOSE", subscription_id] format
    if (type === "EOSE" && rest.length >= 1) {
      const [subId] = rest
      webrtcLogger.debug(peerId, `EOSE ${subId}`, "down")
      return null
    }

    // Handle ["CLOSE", subscription_id] format
    if (type === "CLOSE" && rest.length >= 1) {
      const [subId] = rest
      webrtcLogger.debug(peerId, `CLOSE ${subId}`, "down")
      return null
    }

    webrtcLogger.warn(peerId, `Unsupported message type: ${type}`)
    return null
  } catch (error) {
    webrtcLogger.error(peerId, "Error handling incoming message")
    return null
  }
}
