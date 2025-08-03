import {popularHomeFeedCache} from "@/utils/memcache"
import usePostFetcher from "./usePostFetcher"
import useReactionSubscription from "./useReactionSubscription"
import usePopularityFilters from "./usePopularityFilters"

export default function usePopularHomeFeedEvents() {
  const {currentFilters, expandFilters} = usePopularityFilters(
    popularHomeFeedCache.popularityFilters
  )
  const {getNextMostPopular, hasInitialData} = useReactionSubscription(
    currentFilters,
    expandFilters,
    popularHomeFeedCache.reactionSubscription
  )
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
