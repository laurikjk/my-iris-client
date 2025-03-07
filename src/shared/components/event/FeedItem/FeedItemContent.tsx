import {NDKEvent} from "@nostr-dev-kit/ndk"
import ZapReceipt from "../ZapReceipt.tsx"
import Zapraiser from "../Zapraiser.tsx"
import Highlight from "../Highlight.tsx"
import TextNote from "../TextNote.tsx"
import LongForm from "../LongForm.tsx"
import {memo} from "react"

type ContentProps = {
  event: NDKEvent | undefined
  referredEvent: NDKEvent | undefined
  standalone?: boolean
  truncate: number
}

const FeedItemContent = ({event, referredEvent, standalone, truncate}: ContentProps) => {
  if (!event) {
    return ""
  } else if (referredEvent) {
    return <TextNote event={referredEvent} truncate={truncate} />
  } else if (event.kind === 9735) {
    return <ZapReceipt event={event} />
  } else if (event.kind === 1 && event.tagValue("zapraiser")) {
    return <Zapraiser event={event} />
  } else if (event.kind === 9802) {
    return <Highlight event={event} />
  } else if (event.kind === 30023) {
    return <LongForm event={event} standalone={standalone} />
  } else {
    return <TextNote event={event} truncate={truncate} />
  }
}

export default memo(FeedItemContent)
