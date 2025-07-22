import {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"
import useChronologicalFeed from "./useChronologicalFeed"
import usePopularTabFeed from "./usePopularTabFeed"

interface UseFeedEventsProps {
  filters: NDKFilter
  cacheKey: string
  displayCount: number
  displayFilterFn?: (event: NDKEvent) => boolean
  fetchFilterFn?: (event: NDKEvent) => boolean
  hideEventsByUnknownUsers: boolean
  sortLikedPosts?: boolean
  sortFn?: (a: NDKEvent, b: NDKEvent) => number
}

export default function useFeedEvents({
  filters,
  cacheKey,
  displayCount,
  displayFilterFn,
  fetchFilterFn,
  sortFn,
  hideEventsByUnknownUsers,
  sortLikedPosts = false,
}: UseFeedEventsProps) {
  const chronologicalResult = useChronologicalFeed({
    filters,
    cacheKey,
    displayCount,
    displayFilterFn,
    fetchFilterFn,
    sortFn,
    hideEventsByUnknownUsers,
    enabled: !sortLikedPosts,
  })

  const popularResult = usePopularTabFeed({
    filters,
    cacheKey,
    displayCount,
    displayFilterFn,
    fetchFilterFn,
    sortFn,
    hideEventsByUnknownUsers,
    enabled: sortLikedPosts,
  })

  return sortLikedPosts ? popularResult : chronologicalResult
}
