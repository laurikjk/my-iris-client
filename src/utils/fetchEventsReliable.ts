import {ndk} from "./ndk"
import type {NDKEvent, NDKFilter, NDKSubscription} from "@/lib/ndk"

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
  let sub: NDKSubscription

  const finalize = (resolve: (value: NDKEvent[]) => void) => {
    if (resolved) return
    resolved = true
    if (timeoutHandle) clearTimeout(timeoutHandle)
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
    sub = ndk().subscribe(filterArray, {
      closeOnEose: false, // Keep subscription open
    })

    sub.on("event", (event: NDKEvent) => {
      events.set(event.id, event)

      // Early completion: if this is an ID query and we have all IDs, resolve immediately
      if (requestedIds.size > 0) {
        const haveAllIds = Array.from(requestedIds).every((id) => events.has(id))
        if (haveAllIds) {
          finalize(resolve)
        }
      }
    })

    sub.on("eose", () => {
      // Don't auto-resolve on EOSE - wait for timeout or ID completion
      // This prevents premature resolution when cache responds first
    })

    // Set timeout if specified
    if (opts?.timeout !== undefined) {
      timeoutHandle = setTimeout(() => finalize(resolve), opts.timeout)
    }
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
