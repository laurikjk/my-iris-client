import MarketListing from "../../market/MarketListing"
import ChannelCreation from "../ChannelCreation.tsx"
import {NDKEvent} from "@/lib/ndk"
import ZapReceipt from "../ZapReceipt.tsx"
import {
  KIND_ZAP_RECEIPT,
  KIND_REACTION,
  KIND_TEXT_NOTE,
  KIND_HIGHLIGHT,
  KIND_LONG_FORM_CONTENT,
  KIND_CLASSIFIED,
  KIND_CHANNEL_CREATE,
  KIND_PICTURE_FIRST,
} from "@/utils/constants"
import Zapraiser from "../Zapraiser.tsx"
import Highlight from "../Highlight.tsx"
import TextNote from "../TextNote.tsx"
import LongForm from "../LongForm.tsx"
import PictureFirst from "../PictureFirst.tsx"
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
  } else if (event.kind === KIND_ZAP_RECEIPT) {
    // For zap receipts, if there's a referred event, show that instead
    // If no referred event, it's a direct zap to user, show ZapReceipt
    return referredEvent ? (
      <TextNote event={referredEvent} truncate={truncate} />
    ) : (
      <ZapReceipt event={event} />
    )
  } else if (event.kind === KIND_REACTION) {
    // For reactions, show both the reaction info and the referred event if available
    return referredEvent ? (
      <TextNote event={referredEvent} truncate={truncate} />
    ) : (
      <TextNote event={event} truncate={truncate} />
    )
  } else if (referredEvent) {
    return <TextNote event={referredEvent} truncate={truncate} />
  } else if (event.kind === KIND_TEXT_NOTE && event.tagValue("zapraiser")) {
    return <Zapraiser event={event} truncate={truncate} />
  } else if (event.kind === KIND_HIGHLIGHT) {
    return <Highlight event={event} />
  } else if (event.kind === KIND_LONG_FORM_CONTENT) {
    return <LongForm event={event} standalone={standalone} />
  } else if (event.kind === KIND_CLASSIFIED) {
    return (
      <MarketListing
        key={`${event.id}-${truncate > 0}`}
        event={event}
        truncate={truncate}
      />
    )
  } else if (event.kind === KIND_CHANNEL_CREATE) {
    return <ChannelCreation event={event} />
  } else if (event.kind === KIND_PICTURE_FIRST) {
    return <PictureFirst event={event} truncate={truncate} standalone={standalone} />
  } else {
    return <TextNote event={event} truncate={truncate} />
  }
}

export default memo(FeedItemContent)
