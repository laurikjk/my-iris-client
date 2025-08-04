import {forYouFeedCache} from "@/utils/memcache"
import useReactionSubscription from "./useReactionSubscription"
import useChronologicalSubscription from "./useChronologicalSubscription"
import useCombinedPostFetcher from "./useCombinedPostFetcher"
import usePopularityFilters from "./usePopularityFilters"

export default function useForYouFeedEvents() {
  const {currentFilters, expandFilters} = usePopularityFilters(
    forYouFeedCache.popularityFilters
  )

  const {getNextMostPopular, hasInitialData: hasPopularData} = useReactionSubscription(
    currentFilters,
    expandFilters,
    forYouFeedCache.reactionSubscription,
    true
  )

  const {getNextChronological, hasInitialData: hasChronologicalData} =
    useChronologicalSubscription(forYouFeedCache.chronologicalSubscription, true)

  const {events, loadMore, loading} = useCombinedPostFetcher({
    getNextPopular: getNextMostPopular,
    getNextChronological,
    hasPopularData,
    hasChronologicalData,
    cache: forYouFeedCache.combinedPostFetcher,
    popularRatio: 0.5,
  })

  return {
    events,
    loadMore,
    loading,
  }
}
