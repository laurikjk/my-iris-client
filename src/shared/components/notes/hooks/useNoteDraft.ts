import {useEffect, Dispatch} from "react"
import {useDraftStore} from "@/stores/draft"
import {NDKEvent} from "@/lib/ndk"
import {nip19} from "nostr-tools"
import {NoteCreatorState, NoteCreatorAction} from "./useNoteCreatorState"

export function useNoteDraft(
  draftKey: string,
  state: NoteCreatorState,
  dispatch: Dispatch<NoteCreatorAction>,
  quotedEvent?: NDKEvent
) {
  const draftStore = useDraftStore()
  const hasHydrated = draftStore.hasHydrated

  // Load draft on hydration
  useEffect(() => {
    if (!hasHydrated) return
    const draft = draftStore.getDraft(draftKey)
    if (draft) {
      dispatch({
        type: "LOAD_DRAFT",
        payload: {
          text: draft.content,
          imeta: draft.imeta,
          expirationDelta: draft.expirationDelta,
          eventKind: draft.eventKind,
          price: draft.price,
          title: draft.title,
        },
      })
    } else if (quotedEvent && !state.text) {
      // Set quote link if no existing draft
      const noteId = nip19.noteEncode(quotedEvent.id)
      dispatch({type: "SET_TEXT", payload: `\n\nnostr:${noteId}`})
    }
  }, [hasHydrated, draftKey, quotedEvent])

  // Persist state to draft store
  useEffect(() => {
    if (!hasHydrated) return
    draftStore.setDraft(draftKey, {content: state.text})
  }, [state.text, draftKey, hasHydrated])

  useEffect(() => {
    if (!hasHydrated) return
    draftStore.setDraft(draftKey, {imeta: state.imeta})
  }, [state.imeta, draftKey, hasHydrated])

  useEffect(() => {
    if (!hasHydrated) return
    draftStore.setDraft(draftKey, {expirationDelta: state.expirationDelta})
  }, [state.expirationDelta, draftKey, hasHydrated])

  useEffect(() => {
    if (!hasHydrated) return
    draftStore.setDraft(draftKey, {eventKind: state.eventKind})
  }, [state.eventKind, draftKey, hasHydrated])

  useEffect(() => {
    if (!hasHydrated) return
    draftStore.setDraft(draftKey, {price: state.price})
  }, [state.price, draftKey, hasHydrated])

  useEffect(() => {
    if (!hasHydrated) return
    draftStore.setDraft(draftKey, {title: state.title})
  }, [state.title, draftKey, hasHydrated])

  const clearDraft = () => {
    draftStore.clearDraft(draftKey)
  }

  return {clearDraft, draftStore}
}
