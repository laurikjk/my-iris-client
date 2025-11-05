import {NDKEvent} from "@/lib/ndk"
import {useState, useEffect} from "react"
import {nip19} from "nostr-tools"
import {ndk} from "@/utils/ndk"
import {eventsByIdCache} from "@/utils/memcache"

/**
 * Custom hook for fetching longform events with memcaching
 * Designed specifically for NIP-23 longform content articles
 */
export function useLongformEvent(naddrData: nip19.AddressPointer | null) {
  const [event, setEvent] = useState<NDKEvent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!naddrData) {
      setEvent(null)
      setLoading(false)
      setError(null)
      return
    }

    // Create a cache key for this specific longform event
    const cacheKey = `longform:${naddrData.pubkey}:${naddrData.kind}:${naddrData.identifier}`

    // Check if we already have this event cached
    const cachedEvent = eventsByIdCache.get(cacheKey) as NDKEvent | undefined
    if (cachedEvent) {
      setEvent(cachedEvent)
      setLoading(false)
      setError(null)
      return
    }

    // If not cached, fetch from network
    setLoading(true)
    setError(null)

    ndk()
      .fetchEvent(
        {
          authors: [naddrData.pubkey],
          kinds: [naddrData.kind],
          "#d": [naddrData.identifier],
        },
        undefined
      )
      .then((fetchedEvent) => {
        if (fetchedEvent) {
          // Cache the event for future use
          eventsByIdCache.set(cacheKey, fetchedEvent)
          setEvent(fetchedEvent)
          setError(null)
        } else {
          setError("Event not found")
          setEvent(null)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.warn("Error fetching longform event:", err)
        setError("Failed to fetch event")
        setEvent(null)
        setLoading(false)
      })
  }, [naddrData])

  return {event, loading, error}
}
