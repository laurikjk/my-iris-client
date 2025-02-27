import {useState, useRef, lazy, Suspense, useEffect} from "react"
import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {RiHeartAddLine, RiReplyLine} from "@remixicon/react"
import {NDKEventFromRawEvent} from "@/utils/nostr"
import {Session} from "nostr-double-ratchet"
import {localState} from "irisdb/src"
import classNames from "classnames"

// Lazy load both the emoji picker and data
const EmojiPicker = lazy(() => import("@emoji-mart/react"))

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
  const [emojiData, setEmojiData] = useState<any>(null)

  // Load emoji data only when needed
  useEffect(() => {
    if (showReactionsPicker && !emojiData) {
      import("@emoji-mart/data")
        .then((module) => module.default)
        .then((data) => {
          setEmojiData(data)
        })
    }
  }, [showReactionsPicker, emojiData])

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

  const handleEmojiClick = (emoji: any) => {
    console.log("Reaction selected:", emoji.native)
    setShowReactionsPicker(false)
    const {event} = session.sendEvent({
      kind: 6,
      content: emoji.native,
      tags: [["e", messageId]],
    })
    localState
      .get("sessions")
      .get(sessionId)
      .get("events")
      .get(messageId)
      .get("reactions")
      .get(myPubKey)
      .put(emoji.native)
    NDKEventFromRawEvent(event).publish()
  }

  return (
    <div className="relative -mb-1">
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
            "z-10 mb-2",
            // Use fixed positioning on mobile, absolute on desktop
            "fixed md:absolute md:top-0",
            isUser
              ? "right-4 md:right-0 md:-translate-y-full"
              : "left-4 md:left-0 md:-translate-y-full",
            // Position at bottom of screen on mobile
            "bottom-20 md:bottom-auto"
          )}
        >
          <Suspense
            fallback={<div className="p-4 bg-base-100 rounded shadow">Loading...</div>}
          >
            {emojiData && (
              <EmojiPicker
                data={emojiData}
                onEmojiSelect={handleEmojiClick}
                autoFocus={true}
                previewPosition="none"
                skinTonePosition="none"
                theme="auto"
                maxFrequentRows={1}
              />
            )}
          </Suspense>
        </div>
      )}
    </div>
  )
}

export default MessageReactionButton
