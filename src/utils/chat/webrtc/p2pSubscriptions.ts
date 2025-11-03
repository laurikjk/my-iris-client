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

// Track recent subscriptions to avoid loops (filter hash -> timestamp)
const recentSubs = new Map<string, number>()
const SUB_DEDUPE_WINDOW = 5000 // Don't resend same filter within 5s

// Cleanup recent subs every 10 seconds
setInterval(() => {
  const now = Date.now()
  for (const [hash, timestamp] of recentSubs.entries()) {
    if (now - timestamp > SUB_DEDUPE_WINDOW) {
      recentSubs.delete(hash)
    }
  }
}, 10000)

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

/**
 * Generate stable hash for filter deduplication
 */
function getFilterHash(filter: NDKFilter): string {
  const normalized: Record<string, unknown> = {}
  const keys = Object.keys(filter).sort()
  for (const key of keys) {
    const value = filter[key as keyof NDKFilter]
    if (Array.isArray(value)) {
      normalized[key] = [...value].sort()
    } else {
      normalized[key] = value
    }
  }
  return JSON.stringify(normalized)
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
      const filterSummary = group.filters
        .map((f) => {
          const parts = []
          if (f.kinds) parts.push(`kinds:${f.kinds.join(",")}`)
          if (f.authors) parts.push(`authors:${f.authors.length}`)
          if (f["#p"]) parts.push(`#p:${f["#p"].length}`)
          if (f["#e"]) parts.push(`#e:${f["#e"].length}`)
          if (f.since) parts.push(`since:${f.since}`)
          if (f.until) parts.push(`until:${f.until}`)
          if (f.limit) parts.push(`limit:${f.limit}`)
          return `{${parts.join(", ")}}`
        })
        .join(", ")
      webrtcLogger.debug(peerId, `REQ ${subId} [${filterSummary}]`, "up")
    } catch (error) {
      webrtcLogger.error(peerId, "Failed to send subscription")
    }
  }
}

export function sendSubscriptionToPeersBatched(filters: NDKFilter[]) {
  for (const filter of filters) {
    // Check if we sent this filter recently (avoid loops)
    const filterHash = getFilterHash(filter)
    const lastSent = recentSubs.get(filterHash)
    if (lastSent && Date.now() - lastSent < SUB_DEDUPE_WINDOW) {
      continue
    }
    recentSubs.set(filterHash, Date.now())

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
      webrtcLogger.debug(peerId, `CLOSE ${subId}`, "up")
    } catch (error) {
      webrtcLogger.error(peerId, "Failed to close subscription")
    }
  }
}

/**
 * Handle incoming REQ message from WebRTC peer
 */
export function handleIncomingREQ(peerId: string, subId: string, filters: unknown[]) {
  const filterSummary = (filters as NDKFilter[])
    .map((f) => {
      const parts = []
      if (f.kinds) parts.push(`kinds:${f.kinds.join(",")}`)
      if (f.authors) parts.push(`authors:${f.authors.length}`)
      if (f["#p"]) parts.push(`#p:${f["#p"].length}`)
      if (f["#e"]) parts.push(`#e:${f["#e"].length}`)
      if (f.since) parts.push(`since:${f.since}`)
      if (f.until) parts.push(`until:${f.until}`)
      if (f.limit) parts.push(`limit:${f.limit}`)
      return `{${parts.join(", ")}}`
    })
    .join(", ")
  webrtcLogger.debug(peerId, `REQ ${subId} [${filterSummary}]`, "down")

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
            webrtcLogger.error(peerId, "Failed to send cached event")
          }
        }

        if (sentCount > 0) {
          webrtcLogger.debug(
            peerId,
            `Sent ${sentCount} cached event(s) for ${subId}`,
            "up"
          )
        }

        // Send EOSE
        try {
          peerConn.sendJsonData(["EOSE", subId])
          webrtcLogger.debug(peerId, `EOSE ${subId}`, "up")
        } catch (error) {
          webrtcLogger.error(peerId, "Failed to send EOSE")
        }
      })
      .catch(() => {
        webrtcLogger.error(peerId, "Failed to fetch cached events")
      })
  }
}

/**
 * Handle incoming EOSE message from WebRTC peer
 */
export function handleIncomingEOSE(peerId: string, subId: string) {
  webrtcLogger.debug(peerId, `EOSE ${subId}`, "down")
}

/**
 * Handle incoming CLOSE message from WebRTC peer
 */
export function handleIncomingCLOSE(peerId: string, subId: string) {
  webrtcLogger.debug(peerId, `CLOSE ${subId}`, "down")
  // We don't track subscriptions, so nothing to clean up
}
