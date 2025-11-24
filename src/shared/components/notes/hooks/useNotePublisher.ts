import {useState} from "react"
import NDK, {NDKEvent, NDKKind} from "@/lib/ndk"
import {NoteCreatorState} from "./useNoteCreatorState"
import {buildEventTags} from "../utils/eventTags"

interface UseNotePublisherParams {
  ndkInstance: NDK | undefined
  myPubKey: string | undefined
  replyingTo?: NDKEvent
  quotedEvent?: NDKEvent
  draftKey: string
  gTags?: string[]
  onPublishSuccess: () => void
}

export function useNotePublisher(params: UseNotePublisherParams) {
  const [publishing, setPublishing] = useState(false)

  const publish = async (state: NoteCreatorState) => {
    if (!params.myPubKey || !params.ndkInstance || !state.text.trim() || publishing) {
      return false
    }

    setPublishing(true)
    try {
      const event = new NDKEvent(params.ndkInstance)
      event.kind = state.eventKind as NDKKind
      event.content = state.text
      event.tags = buildEventTags({
        replyingTo: params.replyingTo,
        quotedEvent: params.quotedEvent,
        imeta: state.imeta,
        gTags: params.gTags,
        text: state.text,
        expirationDelta: state.expirationDelta,
        eventKind: state.eventKind,
        title: state.title,
        price: state.price,
        myPubKey: params.myPubKey,
      })

      // Validate tags are all valid arrays
      event.tags = event.tags.filter(
        (tag) => Array.isArray(tag) && tag.every((item) => typeof item === "string")
      )

      await event.sign()

      // Publish optimistically - don't wait for relay operations
      // The publish() method adds to cache and dispatches to local subscriptions synchronously
      // before awaiting relay operations, so we can fire-and-forget
      const publishPromise = event.publish()

      // Small delay to ensure synchronous cache/dispatch operations complete
      await new Promise(resolve => setTimeout(resolve, 50))

      // Background relay publish
      publishPromise.catch((error) => {
        console.error("Failed to publish note:", error)
      })

      setPublishing(false)
      params.onPublishSuccess()

      return {
        success: true,
        eventId: event.id,
      }
    } catch (error) {
      console.error("Failed to create note:", error)
      setPublishing(false)
      return {
        success: false,
        eventId: null,
      }
    }
  }

  return {
    publish,
    publishing,
  }
}
