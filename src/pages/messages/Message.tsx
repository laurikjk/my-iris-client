import {getMillisecondTimestamp, Rumor} from "nostr-double-ratchet"
import classNames from "classnames"

export type MessageType = Rumor & {
  sender?: "user"
}

type MessageProps = {
  message: MessageType
  isFirst: boolean
  isLast: boolean
}

const Message = ({message, isFirst, isLast}: MessageProps) => {
  const isUser = message.sender === "user"
  const emojiRegex =
    /^(\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}]|\p{Emoji_Component}|\u200D|[\u{E0020}-\u{E007F}])+$/u
  const isShortEmoji = emojiRegex.test(message.content.trim())

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
        "max-w-[85%] md:max-w-[70%]",
        isUser ? "ml-auto" : "mr-auto",
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
  )
}

export default Message
