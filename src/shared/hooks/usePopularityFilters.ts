import {useState, useCallback, useMemo} from "react"
import socialGraph, {DEFAULT_SOCIAL_GRAPH_ROOT} from "@/utils/socialGraph"
import useFollows from "@/shared/hooks/useFollows"
import {useUserStore} from "@/stores/user"
import {
  storeOldestTimestamp,
  getStoredOldestTimestamp,
} from "@/utils/timeRangePersistence"

const TIMESTAMP_DECREMENT = 24 * 60 * 60 // Go back 1 day when expanding
const LIMIT = 1000 // Fixed limit
const STORAGE_KEY = "PopularityFiltersOldestTimestamp"

export interface PopularityFilters {
  since: number
  limit: number
  authors: string[] | undefined
}

export default function usePopularityFilters(filterSeen?: boolean) {
  const [oldestTimestamp, setOldestTimestamp] = useState(
    filterSeen
      ? getStoredOldestTimestamp(STORAGE_KEY, 48)
      : Math.floor(Date.now() / 1000) - 48 * 60 * 60
  )

  const myPubKey = useUserStore((state) => state.publicKey)
  const myFollows = useFollows(myPubKey, false)
  const shouldUseFallback = myFollows.length === 0

  const authors = useMemo(() => {
    if (shouldUseFallback) {
      // Use root user's follows immediately (pre-crawled graph loads sync from binary)
      const root = socialGraph().getRoot()
      const rootFollows = Array.from(socialGraph().getFollowedByUser(root))
      // If root follows is also empty, use DEFAULT_SOCIAL_GRAPH_ROOT's follows as last resort
      if (rootFollows.length === 0) {
        return Array.from(socialGraph().getFollowedByUser(DEFAULT_SOCIAL_GRAPH_ROOT))
      }
      return rootFollows
    }
    return myFollows
  }, [shouldUseFallback, myFollows])

  const currentFilters = useMemo<PopularityFilters>(() => {
    const filters = {
      since: oldestTimestamp,
      limit: LIMIT,
      // Don't set authors to empty array - use undefined to match all
      authors: authors.length > 0 ? authors : undefined,
    }
    return filters
  }, [oldestTimestamp, authors])

  const expandFilters = useCallback(() => {
    setOldestTimestamp((prev) => {
      const newOldestTimestamp = prev - TIMESTAMP_DECREMENT
      if (filterSeen) {
        storeOldestTimestamp(STORAGE_KEY, newOldestTimestamp)
      }
      return newOldestTimestamp
    })
  }, [filterSeen])

  return {
    currentFilters,
    expandFilters,
  }
}
