import {getTag, NDKEventFromRawEvent} from "@/utils/nostr.ts"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {nip19} from "nostr-tools"
import {ndk} from "@/utils/ndk"
import {KIND_REPOST, KIND_REACTION, KIND_ZAP_RECEIPT} from "@/utils/constants"

export const handleEventContent = (
  event: NDKEvent,
  setReferredEvent: (event: NDKEvent) => void
): (() => void) | undefined => {
  try {
    if (
      event.kind === KIND_REPOST ||
      event.kind === KIND_REACTION ||
      event.kind === KIND_ZAP_RECEIPT
    ) {
      let originalEvent
      try {
        originalEvent = event.content ? JSON.parse(event.content) : undefined
      } catch (error) {
        // ignore
      }
      if (originalEvent && originalEvent?.id) {
        const ndkEvent = NDKEventFromRawEvent(originalEvent)
        setReferredEvent(ndkEvent)
        return undefined // No cleanup needed
      } else {
        const eTag = getTag("e", event.tags)
        if (eTag) {
          const sub = ndk().subscribe({ids: [eTag]}, {closeOnEose: true})

          sub.on("event", (fetchedEvent: NDKEvent) => {
            if (fetchedEvent && fetchedEvent.id) {
              setReferredEvent(fetchedEvent)
            }
          })

          return () => {
            sub.stop()
          }
        }
      }
    }
  } catch (error) {
    console.warn(error)
  }

  return undefined
}
export const getEventIdHex = (event?: NDKEvent, eventId?: string) => {
  if (event?.id) {
    return event.id
  }
  if (eventId!.indexOf("n") === 0) {
    try {
      const data = nip19.decode(eventId!).data
      if (typeof data === "string") {
        return data
      }
      return (data as nip19.EventPointer).id || ""
    } catch (err) {
      throw new Error(`Invalid note ID format: ${eventId}`)
    }
  }
  if (!eventId) {
    throw new Error("FeedItem requires either an event or an eventId")
  }
  return eventId
}
