import {FloatingEmojiPicker} from "@/shared/components/emoji/FloatingEmojiPicker"
import {RiHeartAddLine, RiReplyLine} from "@remixicon/react"
import {useSessionsStore} from "@/stores/sessions"
import {MouseEvent, useState} from "react"
import classNames from "classnames"
import {KIND_REACTION} from "@/utils/constants"
import {MessageDropdown} from "./MessageDropdown"
import {MessageInfoModal} from "./MessageInfoModal"

type MessageActionButtonsProps = {
  messageId: string
  sessionId: string
  isUser: boolean
  onReply?: () => void
  onSendReaction?: (messageId: string, emoji: string) => Promise<void>
  nostrEventId?: string
  message?: {
    created_at?: number
    tags?: string[][]
    canonicalId?: string
  }
}

type EmojiData = {
  native: string
  [key: string]: unknown
}

const MessageActionButtons = ({
  messageId,
  sessionId,
  isUser,
  onReply,
  onSendReaction,
  nostrEventId,
  message,
}: MessageActionButtonsProps) => {
  const {sendMessage} = useSessionsStore()
  const [showReactionsPicker, setShowReactionsPicker] = useState(false)
  const [pickerPosition, setPickerPosition] = useState<{clientY?: number}>({})
  const [showInfoModal, setShowInfoModal] = useState(false)

  const handleReactionClick = (e: MouseEvent) => {
    const buttonRect = e.currentTarget.getBoundingClientRect()
    setPickerPosition({clientY: buttonRect.top})
    setShowReactionsPicker(!showReactionsPicker)
  }

  const handleEmojiClick = (emoji: EmojiData) => {
    setShowReactionsPicker(false)
    if (onSendReaction) {
      // Use the provided onSendReaction function if available
      onSendReaction(messageId, emoji.native)
    } else {
      // Construct a reaction event
      // Use canonical ID if available, otherwise fall back to message ID
      const reactionTargetId = message?.canonicalId || messageId
      const event = {
        content: emoji.native,
        kind: KIND_REACTION,
        tags: [["e", reactionTargetId]],
      }
      sendMessage(sessionId, event)
    }
  }

  const handleInfoClick = () => {
    setShowInfoModal(true)
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
          data-testid="reaction-button"
          role="button"
          aria-label="Add reaction"
          className="p-2 text-base-content/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity flex-shrink-0"
          onClick={handleReactionClick}
        >
          <RiHeartAddLine className="w-6 h-6" />
        </div>
        <MessageDropdown
          messageId={messageId}
          sessionId={sessionId}
          isUser={isUser}
          onInfoClick={handleInfoClick}
        />
      </div>

      <FloatingEmojiPicker
        isOpen={showReactionsPicker}
        onClose={() => setShowReactionsPicker(false)}
        onEmojiSelect={handleEmojiClick}
        position={{clientY: pickerPosition.clientY, openRight: isUser}}
      />

      <MessageInfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        nostrEventId={nostrEventId}
        sessionId={sessionId}
        messageId={messageId}
        message={message}
      />
    </div>
  )
}

export default MessageActionButtons
