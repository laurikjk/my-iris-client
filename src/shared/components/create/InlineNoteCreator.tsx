import {BaseNoteCreator} from "../notes/BaseNoteCreator"
import {NDKEvent} from "@nostr-dev-kit/ndk"

interface InlineNoteCreatorProps {
  onPublish?: (event: NDKEvent) => void
  repliedEvent?: NDKEvent
  placeholder?: string
  className?: string
}

function InlineNoteCreator({
  onPublish,
  repliedEvent,
  placeholder = "What's on your mind?",
  className = "",
}: InlineNoteCreatorProps) {
  const actualPlaceholder = repliedEvent ? "Write your reply..." : placeholder

  return (
    <BaseNoteCreator
      onClose={onPublish ? () => {} : undefined}
      replyingTo={repliedEvent}
      placeholder={actualPlaceholder}
      autofocus={false}
      variant="inline"
      className={className}
      expandOnFocus={true}
      onPublish={onPublish ? () => onPublish(null as unknown as NDKEvent) : undefined}
    />
  )
}

export default InlineNoteCreator
