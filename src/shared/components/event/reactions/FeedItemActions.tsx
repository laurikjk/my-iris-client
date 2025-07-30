import {NDKEvent} from "@nostr-dev-kit/ndk"

import FeedItemComment from "./FeedItemComment.tsx"
import FeedItemRepost from "./FeedItemRepost.tsx"
import FeedItemShare from "./FeedItemShare.tsx"
import {FeedItemLike} from "./FeedItemLike.tsx"
import FeedItemZap from "./FeedItemZap.tsx"
import {RefObject} from "react"
import {useSettingsStore} from "@/stores/settings"
import {KIND_APP_DATA} from "@/utils/constants"

type FeedItemActionsProps = {
  event: NDKEvent
  feedItemRef: RefObject<HTMLDivElement | null>
  standalone?: boolean
}

function FeedItemActions({event, feedItemRef, standalone = false}: FeedItemActionsProps) {
  const {content} = useSettingsStore()

  // Determine if reaction counts should be shown based on context
  const showReactionCounts = standalone
    ? content.showReactionCountsInStandalone
    : content.showReactionCounts

  if (!content.showReactionsBar) {
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
        <FeedItemComment event={event} />
      )}
      {event.kind !== KIND_APP_DATA && content.showReposts && (
        <FeedItemRepost event={event} />
      )}
      {content.showLikes && (
        <FeedItemLike event={event} showReactionCounts={showReactionCounts} />
      )}
      {content.showZaps && <FeedItemZap feedItemRef={feedItemRef} event={event} />}
      <FeedItemShare event={event} />
    </div>
  )
}

export default FeedItemActions
