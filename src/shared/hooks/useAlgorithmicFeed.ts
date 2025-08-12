import {useEffect, useRef, useState, useCallback} from "react"
import usePopularityFilters from "./usePopularityFilters"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {ReactionSubscriptionService} from "../services/ReactionSubscriptionService"
import {ChronologicalSubscriptionService} from "../services/ChronologicalSubscriptionService"
import {useSocialGraphLoaded} from "@/utils/socialGraph"
import useFollows from "./useFollows"
import {useUserStore} from "@/stores/user"
import {addSeenEventId} from "@/utils/memcache"
import shuffle from "lodash/shuffle"

interface FeedConfig {
  filterSeen?: boolean
  showReplies?: boolean
  popularRatio?: number
}

export default function useAlgorithmicFeed(config: FeedConfig = {}) {
  const {showReplies = false, filterSeen = false, popularRatio = 0.5} = config
  const myPubKey = useUserStore((state) => state.publicKey)
  const follows = useFollows(myPubKey, true)
  const isSocialGraphLoaded = useSocialGraphLoaded()

  const {currentFilters, expandFilters} = usePopularityFilters()

  // Generate cache key from config
  const cacheKey = JSON.stringify(config)

  const reactionService = useRef(new ReactionSubscriptionService(filterSeen, cacheKey))
  const chronologicalService = useRef(
    new ChronologicalSubscriptionService(filterSeen, showReplies, cacheKey)
  )
  const [events, setEvents] = useState<NDKEvent[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const isLoadingRef = useRef(false)

  useEffect(() => {
    return () => {
      reactionService.current.stop()
      chronologicalService.current.stop()
    }
  }, [])

  useEffect(() => {
    if (isSocialGraphLoaded) {
      reactionService.current.start(currentFilters, expandFilters)
    }
  }, [currentFilters, isSocialGraphLoaded])

  useEffect(() => {
    if (isSocialGraphLoaded && follows.length) {
      chronologicalService.current.start(follows)
    }
  }, [follows, isSocialGraphLoaded])

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current) {
      return
    }

    if (!isSocialGraphLoaded) {
      return
    }

    isLoadingRef.current = true
    setLoading(true)

    try {
      const batchSize = 10
      const popularCount = Math.floor(batchSize * popularRatio)
      const chronologicalCount = batchSize - popularCount

      const [popularEvents, chronologicalEvents] = await Promise.all([
        reactionService.current.getNext(popularCount),
        chronologicalService.current.getNext(chronologicalCount),
      ])

      const combinedEvents = [...popularEvents, ...chronologicalEvents]
      const uniqueEvents = Array.from(
        new Map(combinedEvents.map((e) => [e.id, e])).values()
      )

      const shuffledEvents = shuffle(uniqueEvents)

      shuffledEvents.forEach((event) => addSeenEventId(event.id))

      setEvents((prevEvents) => [...prevEvents, ...shuffledEvents])

      isLoadingRef.current = false
      setLoading(false)
    } catch (error) {
      console.error("Error loading more events:", error)
      isLoadingRef.current = false
      setLoading(false)
    }
  }, [popularRatio, isSocialGraphLoaded])

  return {events, loading, loadMore}
}
