import {getMillisecondTimestamp, Rumor, Session} from "nostr-double-ratchet"
import MessageReactionButton from "./MessageReactionButton"
import {Name} from "@/shared/components/user/Name"
import MessageReactions from "./MessageReactions"
import {useEffect, useState} from "react"
import classNames from "classnames"
import {localState} from "irisdb"

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
  onReply?: () => void
}

const Message = ({
  message,
  isFirst,
  isLast,
  session,
  sessionId,
  onReply,
}: MessageProps) => {
  const isUser = message.sender === "user"
  const emojiRegex =
    /^(\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}]|\p{Emoji_Component}|\u200D|[\u{E0020}-\u{E007F}])+$/u
  const isShortEmoji = emojiRegex.test(message.content.trim())
  const [repliedToMessage, setRepliedToMessage] = useState<MessageType | null>(null)

  // Check if message has a reply tag
  const replyToId = message.tags?.find((tag) => tag[0] === "e")?.[1]
  const theirPublicKey = sessionId.split(":")[0]

  // Fetch the replied-to message if it exists
  useEffect(() => {
    if (!replyToId) return

    const fetchReplyMessage = async () => {
      try {
        const replyMsg = await localState
          .get("sessions")
          .get(sessionId)
          .get("events")
          .get(replyToId)
          .once()

        if (replyMsg && typeof replyMsg === "object") {
          setRepliedToMessage(replyMsg as MessageType)
        }
      } catch (error) {
        console.error("Error fetching replied-to message:", error)
      }
    }

    fetchReplyMessage()
  }, [replyToId, sessionId])

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "numeric",
      hour12: undefined, // This will use the locale's preference for 12/24 hour time
    }).format(date)
  }

  return (
    <div
      className={classNames(
        "group relative w-full flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div className="flex items-center justify-center gap-2 max-w-[85%] md:max-w-[70%]">
        {isUser && (
          <MessageReactionButton
            messageId={message.id}
            session={session}
            sessionId={sessionId}
            isUser={isUser}
            onReply={onReply}
          />
        )}

        <div className="flex flex-col">
          {repliedToMessage && (
            <div
              className={classNames(
                "text-xs px-3 py-1 mb-1 rounded-t-lg border-l-2 border-base-content/30",
                isUser
                  ? "bg-primary/20 text-primary-content/70"
                  : "bg-neutral/20 text-neutral-content/70"
              )}
            >
              <div className="font-semibold">
                {repliedToMessage.sender === "user" ? (
                  "You"
                ) : (
                  <Name pubKey={theirPublicKey} />
                )}{" "}
              </div>
              <div className="truncate max-w-[250px]">{repliedToMessage.content}</div>
            </div>
          )}

          <div
            className={classNames(
              !isShortEmoji &&
                (isUser
                  ? "bg-primary text-primary-content"
                  : "bg-neutral text-neutral-content"),
              isShortEmoji && "bg-transparent",
              isFirst && isLast && !repliedToMessage && "rounded-2xl",
              isFirst &&
                !isLast &&
                !repliedToMessage &&
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
                (isUser ? "rounded-l-2xl rounded-r-sm" : "rounded-r-2xl rounded-l-sm"),
              // If there's a replied-to message, adjust the top corners
              repliedToMessage &&
                isFirst &&
                (isUser
                  ? "rounded-bl-2xl rounded-br-sm rounded-tr-2xl"
                  : "rounded-br-2xl rounded-bl-sm rounded-tl-2xl")
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

          <MessageReactions rawReactions={message.reactions} isUser={isUser} />
        </div>

        {!isUser && (
          <MessageReactionButton
            messageId={message.id}
            session={session}
            sessionId={sessionId}
            isUser={isUser}
            onReply={onReply}
          />
        )}
      </div>
    </div>
  )
}

export default Message
