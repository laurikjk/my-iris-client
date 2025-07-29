import {popularHomeFeedCache} from "@/utils/memcache"
import usePostFetcher from "./usePostFetcher"
import useReactionSubscription from "./useReactionSubscription"
import usePopularityFilters from "./usePopularityFilters"

export default function usePopularHomeFeedEvents(
  variant: "popular" | "for-you" = "popular"
) {
  const {currentFilters, expandFilters} = usePopularityFilters(
    popularHomeFeedCache.popularityFilters
  )
  const {getNextMostPopular, hasInitialData} = useReactionSubscription(
    currentFilters,
    expandFilters,
    popularHomeFeedCache.reactionSubscription
  )

  // TODO: Implement for-you variant logic
  // For now, both variants use the same popular feed logic
  if (variant === "for-you") {
    // Future implementation: Mix unseen followed events with popular events
  }

  const {events, loadMore, loading} = usePostFetcher(
    getNextMostPopular,
    hasInitialData,
    popularHomeFeedCache.postFetcher
  )
  return {
    events,
    loadMore,
    loading,
  }
}
