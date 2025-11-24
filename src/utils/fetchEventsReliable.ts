import {ndk} from "./ndk"
import type {NDKEvent, NDKFilter, NDKSubscription} from "@/lib/ndk"
import {createDebugLogger} from "./createDebugLogger"
import {DEBUG_NAMESPACES} from "./constants"

const {log, warn} = createDebugLogger(DEBUG_NAMESPACES.UTILS)

interface FetchOptions {
  timeout?: number // ms to wait before resolving, undefined = no timeout
}

interface FetchResult {
  promise: Promise<NDKEvent[]>
  unsubscribe: () => void
}

/**
 * Reliable event fetching that doesn't rely on broken EOSE logic.
 * Uses subscribe internally and waits for completion or timeout.
 *
 * @param filters - NDK filters
 * @param opts - Options including timeout (default: no timeout)
 * @returns {promise, unsubscribe} - Promise resolves with events, unsubscribe cleans up subscription
 */
export function fetchEventsReliable(
  filters: NDKFilter | NDKFilter[],
  opts?: FetchOptions
): FetchResult {
  const events = new Map<string, NDKEvent>()
  const filterArray = Array.isArray(filters) ? filters : [filters]
  let resolved = false
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  let warningHandle: ReturnType<typeof setTimeout> | undefined
  let sub: NDKSubscription

  const finalize = (resolve: (value: NDKEvent[]) => void) => {
    if (resolved) return
    resolved = true
    if (timeoutHandle) clearTimeout(timeoutHandle)
    if (warningHandle) clearTimeout(warningHandle)
    sub.stop()
    resolve(Array.from(events.values()))
  }

  // For ID-based queries, check if we have all requested IDs
  const requestedIds = new Set<string>()
  filterArray.forEach((f) => {
    if (f.ids) {
      f.ids.forEach((id) => requestedIds.add(id))
    }
  })

  const promise = new Promise<NDKEvent[]>((resolve) => {
    // Log request info
    if (requestedIds.size > 0) {
      log(
        `[fetchEventsReliable] Requesting ${requestedIds.size} events by ID:`,
        Array.from(requestedIds)
          .map((id) => id.slice(0, 8))
          .join(", ")
      )
    }

    sub = ndk().subscribe(filterArray, {
      closeOnEose: false, // Keep subscription open
    })

    sub.on("event", (event: NDKEvent) => {
      events.set(event.id, event)
      log(`[fetchEventsReliable] Received event: ${event.id.slice(0, 8)}`)

      // Early completion: if this is an ID query and we have all IDs, resolve immediately
      if (requestedIds.size > 0) {
        const haveAllIds = Array.from(requestedIds).every((id) => events.has(id))
        if (haveAllIds) {
          log(
            `[fetchEventsReliable] Got all ${requestedIds.size} requested events, resolving`
          )
          finalize(resolve)
        }
      }
    })

    sub.on("eose", () => {
      // Don't auto-resolve on EOSE - wait for timeout or ID completion
      // This prevents premature resolution when cache responds first
      log(
        `[fetchEventsReliable] EOSE received, have ${events.size}/${requestedIds.size} events`
      )
    })

    // Warning after 5 seconds if we haven't resolved
    warningHandle = setTimeout(() => {
      if (!resolved && requestedIds.size > 0) {
        const missing = Array.from(requestedIds).filter((id) => !events.has(id))
        warn(
          `[fetchEventsReliable] Still waiting after 5s. Missing ${missing.length}/${requestedIds.size} events:`,
          missing.map((id) => id.slice(0, 8)).join(", ")
        )
      }
    }, 5000)

    // Set timeout if specified
    // For event-by-ID queries, timeout should only resolve if we have events OR timeout expires
    // Don't resolve on timeout for ID queries - keep subscription open for relays
    if (opts?.timeout !== undefined) {
      timeoutHandle = setTimeout(() => {
        if (requestedIds.size > 0) {
          const missing = Array.from(requestedIds).filter((id) => !events.has(id))
          if (missing.length > 0) {
            warn(
              `[fetchEventsReliable] Timeout (${opts.timeout}ms). Got ${events.size}/${requestedIds.size}, missing:`,
              missing.map((id) => id.slice(0, 8)).join(", ")
            )
          }
        }
        // Resolve with what we have (may be empty for missing events)
        finalize(resolve)
      }, opts.timeout)
    } else if (requestedIds.size === 0) {
      // Non-ID query with no timeout - need to decide when to resolve
      // Wait for EOSE since we don't know how many events to expect
      sub.on("eose", () => {
        log(`[fetchEventsReliable] Non-ID query EOSE, resolving with ${events.size} events`)
        finalize(resolve)
      })
    }
    // If ID query with no timeout, subscription stays open indefinitely until all IDs found
  })

  return {
    promise,
    unsubscribe: () => {
      resolved = true
      if (timeoutHandle) clearTimeout(timeoutHandle)
      if (sub) sub.stop()
    },
  }
}

/**
 * Fetch a single event reliably
 */
export function fetchEventReliable(
  filter: string | NDKFilter,
  opts?: FetchOptions
): {promise: Promise<NDKEvent | null>; unsubscribe: () => void} {
  const filterObj = typeof filter === "string" ? {ids: [filter]} : filter
  const {promise, unsubscribe} = fetchEventsReliable(filterObj, opts)
  return {
    promise: promise.then((events) => events[0] || null),
    unsubscribe,
  }
}
