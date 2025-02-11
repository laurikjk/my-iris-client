import {getTag, NDKEventFromRawEvent, fetchEvent} from "@/utils/nostr.ts"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {nip19} from "nostr-tools"

export const handleEventContent = async (
  event: NDKEvent,
  setReferredEvent: (event: NDKEvent) => void
) => {
  try {
    if (event.kind === 6 || event.kind === 9372 || event.kind === 7) {
      let originalEvent
      try {
        originalEvent = event.content ? JSON.parse(event.content) : undefined
      } catch (error) {
        // ignore
      }
      if (originalEvent && originalEvent?.id) {
        const ndkEvent = NDKEventFromRawEvent(originalEvent)
        setReferredEvent(ndkEvent)
      } else {
        const eTag = getTag("e", event.tags)
        if (eTag) {
          const origEvent = await fetchEvent({ids: [eTag]})
          if (origEvent) setReferredEvent(origEvent)
        }
      }
    }
  } catch (error) {
    console.warn(error)
  }
}
export const fetchDeletionRequest = async (
  event: NDKEvent,
  setReferredEventDeleted: (value: boolean) => void
) => {
  try {
    if (event.kind === 6 || event.kind === 9372) {
      const originalAuthor = event.tagValue("p")
      const originalEventId = event.tagValue("e")

      if (originalAuthor && originalEventId) {
        const filter = {
          kinds: [5],
          authors: [originalAuthor],
          ["#e"]: [originalEventId],
        }

        const deletionEvent = await fetchEvent(filter)
        if (deletionEvent) setReferredEventDeleted(true)
      }
    }
  } catch (error) {
    console.warn(error)
  }
}
export const getEventIdHex = (event?: NDKEvent, eventId?: string) => {
  if (event?.id) {
    return event.id
  }
  if (eventId!.indexOf("n") === 0) {
    const data = nip19.decode(eventId!).data
    if (typeof data === "string") {
      return data
    }
    return (data as nip19.EventPointer).id || ""
  }
  if (!eventId) {
    throw new Error("FeedItem requires either an event or an eventId")
  }
  return eventId
}

export const toRootNote = (
  event: NDKEvent | undefined,
  navigate: (path: string) => void
) => {
  try {
    const rootNoteId = event?.tags.filter(
      (tag) => tag[0] === "e" && tag[3] === "root"
    )[0][1]
    if (rootNoteId) {
      fetchEvent({ids: [rootNoteId]}).then((event: NDKEvent) => {
        if (event) {
          navigate(`/${event.encode()}`)
        }
      })
    }
  } catch (error) {
    console.warn("No root note found")
  }
}
