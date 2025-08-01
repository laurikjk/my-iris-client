import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useState, useEffect, RefObject} from "react"
import {eventsByIdCache} from "@/utils/memcache.ts"
import {ndk} from "@/utils/ndk"

import FeedItemComment from "./FeedItemComment.tsx"
import FeedItemRepost from "./FeedItemRepost.tsx"
import FeedItemShare from "./FeedItemShare.tsx"
import {FeedItemLike} from "./FeedItemLike.tsx"
import FeedItemZap from "./FeedItemZap.tsx"
import {useSettingsStore} from "@/stores/settings"
import {KIND_APP_DATA} from "@/utils/constants"

type FeedItemActionsProps = {
  event?: NDKEvent
  eventId?: string
  feedItemRef: RefObject<HTMLDivElement | null>
  standalone?: boolean
}

function FeedItemActions({
  event: initialEvent,
  eventId,
  feedItemRef,
  standalone = false,
}: FeedItemActionsProps) {
  const [event, setEvent] = useState<NDKEvent | undefined>(initialEvent)
  const {content} = useSettingsStore()

  useEffect(() => {
    if (!event && eventId) {
      const cached = eventsByIdCache.get(eventId)
      if (cached) {
        setEvent(cached)
      } else {
        const sub = ndk().subscribe({ids: [eventId]}, {closeOnEose: true})
        sub.on("event", (fetchedEvent: NDKEvent) => {
          if (fetchedEvent && fetchedEvent.id) {
            setEvent(fetchedEvent)
            eventsByIdCache.set(eventId, fetchedEvent)
          }
        })
        return () => sub.stop()
      }
    }
  }, [event, eventId])

  // Determine if reaction counts should be shown based on context
  const showReactionCounts = standalone
    ? content.showReactionCountsInStandalone
    : content.showReactionCounts

  if (!content.showReactionsBar || !event) {
    return <div className="py-2" />
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={
        "py-2 flex flex-row gap-4 z-20 items-center max-w-full select-none text-base-content/50"
      }
    >
      {event.kind !== KIND_APP_DATA && content.showReplies && (
        <FeedItemComment event={event} showReactionCounts={showReactionCounts} />
      )}
      {event.kind !== KIND_APP_DATA && content.showReposts && (
        <FeedItemRepost event={event} showReactionCounts={showReactionCounts} />
      )}
      {content.showLikes && (
        <FeedItemLike event={event} showReactionCounts={showReactionCounts} />
      )}
      {content.showZaps && (
        <FeedItemZap
          feedItemRef={feedItemRef}
          event={event}
          showReactionCounts={showReactionCounts}
        />
      )}
      <FeedItemShare event={event} />
    </div>
  )
}

export default FeedItemActions
