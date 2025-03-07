import {FloatingEmojiPicker} from "@/shared/components/emoji/FloatingEmojiPicker"
import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {RiHeartAddLine, RiReplyLine} from "@remixicon/react"
import {NDKEventFromRawEvent} from "@/utils/nostr"
import {Session} from "nostr-double-ratchet/src"
import {MouseEvent, useState} from "react"
import {localState} from "irisdb/src"
import classNames from "classnames"

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
  const [pickerPosition, setPickerPosition] = useState<{clientY?: number}>({})

  const handleReactionClick = (e: MouseEvent) => {
    const buttonRect = e.currentTarget.getBoundingClientRect()
    setPickerPosition({clientY: buttonRect.top})
    setShowReactionsPicker(!showReactionsPicker)
  }

  const handleEmojiClick = (emoji: any) => {
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

      <FloatingEmojiPicker
        isOpen={showReactionsPicker}
        onClose={() => setShowReactionsPicker(false)}
        onEmojiSelect={handleEmojiClick}
        position={{clientY: pickerPosition.clientY, openRight: isUser}}
      />
    </div>
  )
}

export default MessageReactionButton
