import {NDKEvent} from "@nostr-dev-kit/ndk"
import ZapReceipt from "../ZapReceipt.tsx"
import {lazy, memo, Suspense} from "react"
import Zapraiser from "../Zapraiser.tsx"
import Highlight from "../Highlight.tsx"
import TextNote from "../TextNote.tsx"

type ContentProps = {
  event: NDKEvent | undefined
  referredEvent: NDKEvent | undefined
  standalone?: boolean
  truncate: number
}

const LongForm = lazy(() => import("../LongForm.tsx"))

const FeedItemContent = ({event, referredEvent, standalone, truncate}: ContentProps) => {
  if (!event) {
    return ""
  } else if (referredEvent) {
    return <TextNote event={referredEvent} />
  } else if (event.kind === 9735) {
    return <ZapReceipt event={event} />
  } else if (event.kind === 1 && event.tagValue("zapraiser")) {
    return <Zapraiser event={event} />
  } else if (event.kind === 9802) {
    return <Highlight event={event} />
  } else if (event.kind === 30023) {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <LongForm event={event} standalone={standalone} />
      </Suspense>
    )
  } else {
    return <TextNote event={event} truncate={truncate} />
  }
}

export default memo(FeedItemContent)
