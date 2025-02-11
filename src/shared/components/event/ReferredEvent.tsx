import {NDKEvent} from "@nostr-dev-kit/ndk"

import IssueFeedItem from "./IssueFeedItem.tsx"
import {isIssue} from "@/utils/nostr.ts"
import TextNote from "./TextNote.tsx"

interface ReferredEventProps {
  referredEvent: NDKEvent
}

function ReferredEvent({referredEvent}: ReferredEventProps) {
  if (referredEvent && referredEvent.kind === 1) {
    return <TextNote event={referredEvent} truncate={300} />
  }
  if (referredEvent && isIssue(referredEvent)) {
    return <IssueFeedItem event={referredEvent} />
  }

  return (
    <div className="TextNote-container">
      <p>The note is loading or cannot be found on your relay list.</p>
    </div>
  )
}

export default ReferredEvent
