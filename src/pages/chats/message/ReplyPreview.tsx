import {Name} from "@/shared/components/user/Name"
import {usePrivateMessagesStore} from "@/stores/privateMessages"
// import {useSessionsStore} from "@/stores/sessions" // TEMP: Removed
import {useState, useEffect} from "react"
import {MessageType} from "./Message"
import classNames from "classnames"
import {ndk} from "@/utils/ndk"
import {useUserStore} from "@/stores/user"

type ReplyPreviewProps = {
  isUser: boolean
  sessionId: string
  replyToId: string
}

const ReplyPreview = ({isUser, sessionId, replyToId}: ReplyPreviewProps) => {
  const [repliedToMessage, setRepliedToMessage] = useState<MessageType | null>(null)
  const {events} = usePrivateMessagesStore()

  // No need to find the reply tag here since we're passing it directly
  // TEMP: Dummy implementation
  const theirPublicKey = sessionId.split(":")[0]

  // Function to handle scrolling to the replied message
  const handleScrollToReply = () => {
    const element = document.getElementById(replyToId)
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
      // Optional: highlight the message briefly
      element.classList.add("highlight-message")
      setTimeout(() => element.classList.remove("highlight-message"), 2000)
    }
  }

  // Fetch the replied-to message if it exists
  useEffect(() => {
    if (!replyToId) return

    const fetchReplyMessage = async () => {
      try {
        // For private chats (sessionId contains ":")
        if (sessionId.includes(":")) {
          const sessionEvents = events.get(sessionId)
          if (sessionEvents) {
            const replyMsg = sessionEvents.get(replyToId)
            if (replyMsg) {
              setRepliedToMessage(replyMsg)
              return
            }
          }
        }

        // For public chats (sessionId is just the channel ID)
        const event = await ndk().fetchEvent({
          ids: [replyToId],
        })

        if (event) {
          const message: MessageType = {
            id: event.id,
            pubkey: event.pubkey,
            content: event.content,
            created_at: event.created_at || Math.floor(Date.now() / 1000),
            tags: event.tags,
            kind: event.kind,
            reactions: {},
          }
          setRepliedToMessage(message)
        }
      } catch (error) {
        console.error("Error fetching replied-to message:", error)
      }
    }

    fetchReplyMessage()
  }, [replyToId, sessionId, theirPublicKey, events])

  if (!repliedToMessage) return null

  return (
    <div
      className={classNames(
        "text-xs px-3 py-1 mx-2 mt-2 border-l-2 border-base-content/30 rounded-sm cursor-pointer text-primary-content/70",
        isUser ? "bg-neutral/20" : "bg-primary/80"
      )}
      onClick={handleScrollToReply}
    >
      <div className="font-semibold">
        {repliedToMessage.pubkey === useUserStore.getState().publicKey ? (
          "You"
        ) : (
          <Name
            pubKey={sessionId.includes(":") ? theirPublicKey : repliedToMessage.pubkey}
          />
        )}{" "}
      </div>
      <div className="truncate max-w-[225px]">{repliedToMessage.content}</div>
    </div>
  )
}

export default ReplyPreview
