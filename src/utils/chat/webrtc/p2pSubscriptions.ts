import {type NDKFilter} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {getAllConnections} from "./PeerConnection"
import {webrtcLogger} from "./Logger"
import {RateLimiter} from "./RateLimiter"
import {incrementSubscriptionsServed} from "./p2pStats"

// Subscription rate limiter: 5 per second per peer
const incomingSubRateLimiter = new RateLimiter(5, 1000)

// Cleanup rate limiter every 5 seconds
setInterval(() => {
  incomingSubRateLimiter.cleanup()
}, 5000)

// Subscription grouping: similar to NDK's groupableDelay
const GROUPING_DELAY = 200 // ms

type FilterGroup = {
  filters: NDKFilter[]
  timeout: NodeJS.Timeout
}

const filterGroups = new Map<string, FilterGroup>()

/**
 * Generate grouping key from filter
 * Groups filters with same authors, #p, or #e tags
 */
function getGroupingKey(filter: NDKFilter): string {
  const parts: string[] = []

  if (filter.authors?.length) {
    parts.push(`authors:${filter.authors.sort().join(",")}`)
  }
  if (filter["#p"]?.length) {
    parts.push(`#p:${filter["#p"].sort().join(",")}`)
  }
  if (filter["#e"]?.length) {
    parts.push(`#e:${filter["#e"].sort().join(",")}`)
  }

  // If no groupable keys, use a unique key (won't merge)
  return parts.length > 0 ? parts.join("|") : crypto.randomUUID()
}

function sendGroupedFilters(groupKey: string) {
  const group = filterGroups.get(groupKey)
  if (!group) return

  filterGroups.delete(groupKey)

  const subId = crypto.randomUUID()
  const connections = getAllConnections()
  const message = ["REQ", subId, ...group.filters]

  let sentCount = 0
  for (const [peerId, conn] of connections.entries()) {
    if (conn.dataChannel?.readyState !== "open") continue

    try {
      conn.sendJsonData(message)
      sentCount++
      webrtcLogger.debug(peerId, `↑ REQ ${subId} with ${group.filters.length} filter(s)`)
    } catch (error) {
      webrtcLogger.error(peerId, "Failed to send subscription", error)
    }
  }

  if (sentCount > 0) {
    webrtcLogger.debug(undefined, `↑ Sent REQ ${subId} to ${sentCount} peer(s)`)
  }
}

export function sendSubscriptionToPeersBatched(filters: NDKFilter[]) {
  for (const filter of filters) {
    const groupKey = getGroupingKey(filter)
    const existing = filterGroups.get(groupKey)

    if (existing) {
      // Add to existing group and reset timer
      existing.filters.push(filter)
      clearTimeout(existing.timeout)
      existing.timeout = setTimeout(() => sendGroupedFilters(groupKey), GROUPING_DELAY)
    } else {
      // Create new group
      const timeout = setTimeout(() => sendGroupedFilters(groupKey), GROUPING_DELAY)
      filterGroups.set(groupKey, {filters: [filter], timeout})
    }
  }
}

/**
 * Close subscription on WebRTC peers
 */
export function closeSubscriptionOnPeers(subId: string) {
  const connections = getAllConnections()
  const message = ["CLOSE", subId]

  for (const [peerId, conn] of connections.entries()) {
    if (conn.dataChannel?.readyState !== "open") continue

    try {
      conn.sendJsonData(message)
      webrtcLogger.debug(peerId, `↑ CLOSE ${subId}`)
    } catch (error) {
      webrtcLogger.error(peerId, "Failed to close subscription", error)
    }
  }
}

/**
 * Handle incoming REQ message from WebRTC peer
 */
export function handleIncomingREQ(peerId: string, subId: string, filters: unknown[]) {
  webrtcLogger.debug(peerId, `↓ REQ ${subId} with ${filters.length} filter(s)`)

  // Rate limit incoming subscriptions
  if (!incomingSubRateLimiter.check(peerId)) {
    webrtcLogger.warn(peerId, `Rate limit exceeded for incoming REQ`)
    return
  }

  // Track subscription served
  incrementSubscriptionsServed()

  // Query NDK cache and reply with matching events
  const ndkInstance = ndk()
  const peerConn = getAllConnections().get(peerId)
  if (!peerConn) return

  // Query each filter separately with reasonable limit
  for (const filter of filters as NDKFilter[]) {
    const limitedFilter = {...filter, limit: Math.min(filter.limit || 100, 100)}
    ndkInstance
      .fetchEvents(limitedFilter)
      .then((events) => {
        let sentCount = 0
        for (const event of events) {
          if (!event.id) continue

          // Skip if peer already saw this event
          if (peerConn.seenEvents.has(event.id)) continue

          const eventJson = event.rawEvent()
          if (!eventJson) continue

          // Send event to peer
          const message = ["EVENT", subId, eventJson]
          try {
            peerConn.sendJsonData(message)
            peerConn.seenEvents.set(event.id, true)
            sentCount++
          } catch (error) {
            webrtcLogger.error(peerId, "Failed to send cached event", error)
          }
        }

        if (sentCount > 0) {
          webrtcLogger.debug(peerId, `↑ Sent ${sentCount} cached event(s) for ${subId}`)
        }

        // Send EOSE
        try {
          peerConn.sendJsonData(["EOSE", subId])
          webrtcLogger.debug(peerId, `↑ EOSE ${subId}`)
        } catch (error) {
          webrtcLogger.error(peerId, "Failed to send EOSE", error)
        }
      })
      .catch((error) => {
        webrtcLogger.error(peerId, "Failed to fetch cached events", error)
      })
  }
}

/**
 * Handle incoming EOSE message from WebRTC peer
 */
export function handleIncomingEOSE(peerId: string, subId: string) {
  webrtcLogger.debug(peerId, `↓ EOSE ${subId}`)
}

/**
 * Handle incoming CLOSE message from WebRTC peer
 */
export function handleIncomingCLOSE(peerId: string, subId: string) {
  webrtcLogger.debug(peerId, `↓ CLOSE ${subId}`)
  // We don't track subscriptions, so nothing to clean up
}
