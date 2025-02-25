import {getMillisecondTimestamp, Rumor, Session} from "nostr-double-ratchet"
import {useState, useRef, lazy, Suspense, useEffect} from "react"
import {UserRow} from "@/shared/components/user/UserRow"
import {NDKEventFromRawEvent} from "@/utils/nostr"
import {RiHeartAddLine} from "@remixicon/react"
import {useLocalState} from "irisdb-hooks"
import classNames from "classnames"
import {localState} from "irisdb"

// Lazy load the emoji picker
const EmojiPicker = lazy(() => import("emoji-picker-react"))

export type MessageType = Rumor & {
  sender?: "user"
  reactions?: Record<string, string>
}

type MessageProps = {
  message: MessageType
  isFirst: boolean
  isLast: boolean
  session: Session
  sessionId: string
}

// MessageReactions component
const MessageReactions = ({
  rawReactions,
  isUser,
}: {
  rawReactions: Record<string, string> | undefined
  isUser: boolean
}) => {
  const [showReactedUsers, setShowReactedUsers] = useState(false)
  const [currentEmoji, setCurrentEmoji] = useState<string>("")
  const reactionsRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close the emoji user list and ESC key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (reactionsRef.current && !reactionsRef.current.contains(event.target as Node)) {
        setShowReactedUsers(false)
      }
    }

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showReactedUsers) {
        setShowReactedUsers(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscKey)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscKey)
    }
  }, [showReactedUsers])

  // Process reactions to group same emojis together
  const processReactions = () => {
    if (!rawReactions || Object.keys(rawReactions).length === 0) return null

    const reactionCounts: Record<string, number> = {}
    const usersByEmoji: Record<string, string[]> = {}

    Object.entries(rawReactions).forEach(([userId, emoji]) => {
      reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1

      if (!usersByEmoji[emoji]) {
        usersByEmoji[emoji] = []
      }
      usersByEmoji[emoji].push(userId)
    })

    return {reactionCounts, usersByEmoji}
  }

  const processed = processReactions()
  const reactionCounts = processed?.reactionCounts || null
  const usersByEmoji = processed?.usersByEmoji || {}

  if (!reactionCounts || Object.keys(reactionCounts).length === 0) {
    return null
  }

  const showUsers = (emoji: string) => {
    if (showReactedUsers && currentEmoji === emoji) {
      setShowReactedUsers(false)
    } else {
      setCurrentEmoji(emoji)
      setShowReactedUsers(true)
    }
  }

  return (
    <div className="relative" ref={reactionsRef}>
      <div
        className={classNames(
          "flex flex-wrap gap-1 -mt-2",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        {Object.entries(reactionCounts).map(([emoji, count]) => (
          <div
            key={emoji}
            className="flex items-center bg-base-100 border border-custom border-base-200 rounded-full px-2 cursor-pointer hover:bg-base-200"
            onClick={() => showUsers(emoji)}
          >
            <span className="text-md">{emoji}</span>
            {count > 1 && (
              <span className="ml-1 text-base-content/70 text-xs">{count}</span>
            )}
          </div>
        ))}
      </div>

      {/* User list popup */}
      {showReactedUsers && usersByEmoji[currentEmoji] && (
        <div className="absolute z-10 mt-1 bg-base-100 shadow-md rounded-md p-2 text-sm w-64 max-h-48 overflow-y-auto flex flex-col gap-2">
          {usersByEmoji[currentEmoji].map((userId) => (
            <div key={userId} className="py-1 flex items-center">
              <span className="text-lg p-2">{currentEmoji}</span>{" "}
              <UserRow avatarWidth={32} pubKey={userId} linkToProfile={false} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const Message = ({message, isFirst, isLast, session, sessionId}: MessageProps) => {
  const [myPubKey] = useLocalState("user/publicKey", "")
  const [showReactionsPicker, setShowReactionsPicker] = useState(false)
  const reactionsPickerRef = useRef<HTMLDivElement>(null)
  const isUser = message.sender === "user"
  const emojiRegex =
    /^(\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}]|\p{Emoji_Component}|\u200D|[\u{E0020}-\u{E007F}])+$/u
  const isShortEmoji = emojiRegex.test(message.content.trim())

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

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "numeric",
      hour12: undefined, // This will use the locale's preference for 12/24 hour time
    }).format(date)
  }

  const handleReactionClick = () => {
    setShowReactionsPicker(!showReactionsPicker)
  }

  const handleEmojiClick = (emojiData: any) => {
    console.log("Reaction selected:", emojiData.emoji)
    // TODO: Handle adding reaction to message
    setShowReactionsPicker(false)
    const {event} = session.sendEvent({
      kind: 6,
      content: emojiData.emoji,
      tags: [["e", message.id]],
    })
    localState
      .get("sessions")
      .get(sessionId)
      .get("events")
      .get(message.id)
      .get("reactions")
      .get(myPubKey)
      .put(emojiData.emoji)
    NDKEventFromRawEvent(event).publish()
  }

  const reactionButton = (
    <div
      className="p-2 text-base-content/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity flex-shrink-0"
      onClick={handleReactionClick}
    >
      <RiHeartAddLine className="w-6 h-6" />
    </div>
  )

  return (
    <div
      className={classNames(
        "group relative w-full flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div className="flex items-center justify-center gap-2 max-w-[85%] md:max-w-[70%]">
        {isUser && reactionButton}

        <div className="flex flex-col">
          <div
            className={classNames(
              !isShortEmoji &&
                (isUser
                  ? "bg-primary text-primary-content"
                  : "bg-neutral text-neutral-content"),
              isShortEmoji && "bg-transparent",
              isFirst && isLast && "rounded-2xl",
              isFirst &&
                !isLast &&
                (isUser
                  ? "rounded-t-2xl rounded-bl-2xl rounded-br-sm"
                  : "rounded-t-2xl rounded-br-2xl rounded-bl-sm"),
              !isFirst &&
                isLast &&
                (isUser
                  ? "rounded-b-2xl rounded-tl-2xl rounded-tr-sm"
                  : "rounded-b-2xl rounded-tr-2xl rounded-tl-sm"),
              !isFirst &&
                !isLast &&
                (isUser ? "rounded-l-2xl rounded-r-sm" : "rounded-r-2xl rounded-l-sm")
            )}
          >
            <div
              className={classNames(
                "px-3 py-2",
                isLast && "flex justify-between items-end",
                isShortEmoji && "flex-col gap-1 items-center"
              )}
            >
              <p className={classNames(isShortEmoji ? "text-6xl" : "text-sm")}>
                {message.content}
              </p>
              {isLast && (
                <p className="text-xs opacity-50 ml-2 whitespace-nowrap">
                  {formatTime(getMillisecondTimestamp(message))}
                </p>
              )}
            </div>
          </div>

          {/* Updated to pass raw reactions data */}
          <MessageReactions rawReactions={message.reactions} isUser={isUser} />
        </div>

        {!isUser && reactionButton}

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
    </div>
  )
}

export default Message
