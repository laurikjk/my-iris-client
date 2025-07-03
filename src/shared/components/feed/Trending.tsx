import InfiniteScroll from "@/shared/components/ui/InfiniteScroll.tsx"
import socialGraph, {socialGraphLoaded} from "@/utils/socialGraph"
import {NDKEventFromRawEvent, RawEvent} from "@/utils/nostr.ts"
import {useCallback, useState, useMemo, useEffect} from "react"
import useCachedFetch from "@/shared/hooks/useCachedFetch.ts"
import {NDKEvent, NDKRelaySet} from "@nostr-dev-kit/ndk"
import EventBorderless from "../event/EventBorderless"
import FeedItem from "../event/FeedItem/FeedItem"
import useMutes from "@/shared/hooks/useMutes"
import classNames from "classnames"
import {ndk} from "@/utils/ndk"

class NostrBandApi {
  readonly #url = "https://api.nostr.band"
  readonly #supportedLangs = ["en", "de", "ja", "zh", "th", "pt", "es", "fr"]

  trendingProfilesUrl() {
    return `${this.#url}/v0/trending/profiles`
  }

  trendingNotesUrl(lang?: string) {
    return `${this.#url}/v0/trending/notes${lang && this.#supportedLangs.includes(lang) ? `?lang=${lang}` : ""}`
  }

  suggestedFollowsUrl(pubkey: string) {
    return `${this.#url}/v0/suggested/profiles/${pubkey}`
  }

  trendingVideosUrl(lang?: string) {
    return `${this.#url}/v0/trending/videos${lang && this.#supportedLangs.includes(lang) ? `?lang=${lang}` : ""}`
  }

  trendingImagesUrl(lang?: string) {
    return `${this.#url}/v0/trending/images${lang && this.#supportedLangs.includes(lang) ? `?lang=${lang}` : ""}`
  }
}

type TrendingData = {
  notes?: Array<{event: RawEvent}>
  videos?: Array<{event: RawEvent}>
  images?: Array<{event: RawEvent}>
}

type TrendingItem = RawEvent

export default function Trending({
  small = true,
  contentType = "notes",
  randomSort = true,
}: {
  small?: boolean
  contentType?: "notes" | "videos" | "images"
  randomSort?: boolean
}) {
  const [isSocialGraphLoaded, setIsSocialGraphLoaded] = useState(false)
  const api = useMemo(() => new NostrBandApi(), [])
  const lang = useMemo(() => navigator.language.split(/[_-]+/)[0], [])
  const trendingUrl = useMemo(() => {
    switch (contentType) {
      case "videos":
        return api.trendingVideosUrl(lang)
      case "images":
        return api.trendingImagesUrl(lang)
      default:
        return api.trendingNotesUrl(lang)
    }
  }, [api, lang, contentType])
  const storageKey = `nostr-band-${trendingUrl}`
  const [displayCount, setDisplayCount] = useState(10)
  const mutes = useMutes()

  const {
    data: trendingData,
    isLoading,
    error,
  } = useCachedFetch<TrendingData, TrendingItem[]>(
    trendingUrl,
    storageKey,
    useCallback(
      (data: TrendingData) => {
        const events = data.notes || data.videos || data.images || []
        return events
          .map((a: {event: RawEvent}) => {
            const ev = a.event
            const ndkEvent = NDKEventFromRawEvent(ev)
            // save event to local ndk storage (?)
            ndkEvent.publish(new NDKRelaySet(new Set(), ndk()))
            if (!ndkEvent.verifySignature(true)) {
              console.error(`Event with invalid sig\n\n${ev}\n\nfrom ${trendingUrl}`)
              return undefined
            }
            return ev
          })
          .filter((a): a is RawEvent => a !== undefined)
      },
      [contentType, trendingUrl]
    )
  )

  const sortedData = useMemo(() => {
    if (!trendingData) return []
    return randomSort ? [...trendingData].sort(() => Math.random() - 0.5) : trendingData
  }, [trendingData, randomSort])

  const loadMore = useCallback(() => {
    setDisplayCount((prevCount) => Math.min(prevCount + 10, sortedData.length))
  }, [sortedData])

  useEffect(() => {
    socialGraphLoaded.then(() => {
      setIsSocialGraphLoaded(true)
    })
  }, [])

  const isTestEnvironment =
    typeof window !== "undefined" && window.location.href.includes("localhost:5173")
  if (!isSocialGraphLoaded && !isTestEnvironment) {
    return null
  }

  return (
    <InfiniteScroll onLoadMore={loadMore}>
      <div className={classNames("flex flex-col gap-8", {"text-base-content/50": small})}>
        {error && !sortedData.length ? (
          <div className="px-4">Error: {`${error}`}</div>
        ) : null}
        {isLoading ? <div className="px-4">Loading...</div> : null}
        {sortedData
          .slice(0, displayCount)
          .filter(
            (e: TrendingItem): e is RawEvent =>
              "pubkey" in e &&
              !!(e && socialGraph().getFollowersByUser(e.pubkey).size > 0) &&
              !mutes.includes(e.pubkey)
          )
          .map(
            (ev, index) =>
              ev &&
              (small ? (
                <EventBorderless key={index} event={ev as RawEvent} />
              ) : (
                <FeedItem key={index} event={new NDKEvent(ndk(), ev as RawEvent)} />
              ))
          )}
      </div>
    </InfiniteScroll>
  )
}
