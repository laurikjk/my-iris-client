import {useState, useRef, lazy, Suspense, useEffect} from "react"
import {RiHeartAddLine, RiReplyLine} from "@remixicon/react"
import {NDKEventFromRawEvent} from "@/utils/nostr"
import {Session} from "nostr-double-ratchet"
import {useLocalState} from "irisdb-hooks"
import classNames from "classnames"
import {localState} from "irisdb"

// Lazy load the emoji picker
const EmojiPicker = lazy(() => import("emoji-picker-react"))

type MessageReactionButtonProps = {
  messageId: string
  session: Session
  sessionId: string
  isUser: boolean
  onReply?: () => void
}

const MessageReactionButton = ({
  messageId,
  session,
  sessionId,
  isUser,
  onReply,
}: MessageReactionButtonProps) => {
  const [myPubKey] = useLocalState("user/publicKey", "")
  const [showReactionsPicker, setShowReactionsPicker] = useState(false)
  const reactionsPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Close reactions picker when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        reactionsPickerRef.current &&
        !reactionsPickerRef.current.contains(event.target as Node)
      ) {
        setShowReactionsPicker(false)
      }
    }

    // Close reactions picker when pressing Escape key
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showReactionsPicker) {
        setShowReactionsPicker(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscKey)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscKey)
    }
  }, [showReactionsPicker])

  const handleReactionClick = () => {
    setShowReactionsPicker(!showReactionsPicker)
  }

  const handleEmojiClick = (emojiData: any) => {
    console.log("Reaction selected:", emojiData.emoji)
    setShowReactionsPicker(false)
    const {event} = session.sendEvent({
      kind: 6,
      content: emojiData.emoji,
      tags: [["e", messageId]],
    })
    localState
      .get("sessions")
      .get(sessionId)
      .get("events")
      .get(messageId)
      .get("reactions")
      .get(myPubKey)
      .put(emojiData.emoji)
    NDKEventFromRawEvent(event).publish()
  }

  return (
    <div className="relative">
      <div
        className={classNames("flex items-center", {
          "flex-row-reverse": !isUser,
        })}
      >
        {onReply && (
          <div
            className="p-2 text-base-content/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity flex-shrink-0"
            onClick={onReply}
          >
            <RiReplyLine className="w-6 h-6" />
          </div>
        )}
        <div
          className="p-2 text-base-content/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity flex-shrink-0"
          onClick={handleReactionClick}
        >
          <RiHeartAddLine className="w-6 h-6" />
        </div>
      </div>

      {showReactionsPicker && (
        <div
          ref={reactionsPickerRef}
          className={classNames(
            "absolute z-10 -top-6 mb-2",
            isUser ? "right-0" : "left-0"
          )}
        >
          <Suspense
            fallback={<div className="p-4 bg-base-100 rounded shadow">Loading...</div>}
          >
            <EmojiPicker
              reactionsDefaultOpen={true}
              onEmojiClick={handleEmojiClick}
              width={320}
              height="auto"
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}

export default MessageReactionButton
