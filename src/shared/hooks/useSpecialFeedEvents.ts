import {specialFeedCache} from "@/utils/memcache"
import usePostFetcher from "./usePostFetcher"
import useReactionSubscription from "./useReactionSubscription"
import usePopularityFilters from "./usePopularityFilters"

export default function useSpecialFeedEvents() {
  const {currentFilters, expandFilters} = usePopularityFilters(specialFeedCache.popularityFilters)
  const {getNextMostPopular, hasInitialData} = useReactionSubscription(
    currentFilters,
    expandFilters,
    specialFeedCache.reactionSubscription
  )
  const {events, loadMore, loading} = usePostFetcher(
    getNextMostPopular,
    hasInitialData,
    specialFeedCache.postFetcher
  )
  return {
    events,
    loadMore,
    loading,
  }
}
