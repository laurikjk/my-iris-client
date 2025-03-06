import {getMillisecondTimestamp, Rumor, Session} from "nostr-double-ratchet/src"
import MessageReactionButton from "./MessageReactionButton"
import MessageReactions from "./MessageReactions"
import ReplyPreview from "./ReplyPreview"
import classNames from "classnames"
import {useMemo} from "react"

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

// Moved regex outside component to avoid recreation on each render
const EMOJI_REGEX =
  /^(\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}]|\p{Emoji_Component}|\u200D|[\u{E0020}-\u{E007F}])+$/u

// Extracted time formatting logic
const formatMessageTime = (timestamp: number): string => {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "numeric",
    hour12: undefined,
  }).format(new Date(timestamp))
}

// Extracted className generation logic
const getMessageClassName = (
  isUser: boolean,
  isFirst: boolean,
  isLast: boolean,
  isShortEmoji: boolean
) => {
  return classNames(
    !isShortEmoji &&
      (isUser ? "bg-primary text-primary-content" : "bg-neutral text-neutral-content"),
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
  )
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
  const isShortEmoji = useMemo(
    () => EMOJI_REGEX.test(message.content?.trim() ?? ""),
    [message.content]
  )

  const repliedId = useMemo(
    () => message.tags?.find((tag) => tag[0] === "e")?.[1],
    [message.tags]
  )

  const messageClassName = useMemo(
    () => getMessageClassName(isUser, isFirst, isLast, isShortEmoji),
    [isUser, isFirst, isLast, isShortEmoji]
  )

  const formattedTime = useMemo(
    () => formatMessageTime(getMillisecondTimestamp(message)),
    [message]
  )

  return (
    <div
      className={classNames(
        "group relative w-full flex",
        isUser ? "justify-end" : "justify-start"
      )}
      id={message.id}
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
          <div className={messageClassName}>
            {repliedId && (
              <ReplyPreview isUser={isUser} sessionId={sessionId} replyToId={repliedId} />
            )}
            <div
              className={classNames(
                "px-3 py-2",
                isLast && "flex justify-between items-end",
                isShortEmoji && "flex-col gap-1 items-center"
              )}
            >
              <p
                className={classNames(
                  isShortEmoji ? "text-6xl" : "text-sm",
                  "whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                )}
              >
                {message.content}
              </p>
              {isLast && (
                <p className="text-xs opacity-50 ml-2 whitespace-nowrap">
                  {formattedTime}
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
