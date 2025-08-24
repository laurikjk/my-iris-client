import {BaseNoteCreator} from "../notes/BaseNoteCreator"
import {NDKEvent} from "@nostr-dev-kit/ndk"

type handleCloseFunction = () => void

interface NoteCreatorProps {
  repliedEvent?: NDKEvent
  quotedEvent?: NDKEvent
  handleClose: handleCloseFunction
  reset?: boolean
}

function NoteCreator({handleClose, repliedEvent}: NoteCreatorProps) {
  return (
    <BaseNoteCreator
      onClose={handleClose}
      replyingTo={repliedEvent}
      placeholder="What's on your mind?"
      autofocus={true}
      variant="modal"
      showPreview={true}
    />
  )
}

export default NoteCreator
