import ChatContainer from "../components/ChatContainer"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {comparator} from "../utils/messageGrouping"
import PrivateChatHeader from "./PrivateChatHeader"
import {usePrivateMessagesStore} from "@/stores/privateMessages"
import MessageForm from "../message/MessageForm"
import {MessageType} from "../message/Message"
import {useEffect, useState} from "react"
import {useUserStore} from "@/stores/user"
import {KIND_REACTION} from "@/utils/constants"

const updateLastSeen = (id: string) => {}

const Chat = ({id}: {id: string}) => {
  // id is now userPubKey instead of sessionId
  const [haveReply, setHaveReply] = useState(false)
  const [haveSent, setHaveSent] = useState(false)
  const [replyingTo, setReplyingTo] = useState<MessageType | undefined>(undefined)

  // Allow messaging regardless of session state - sessions will be created automatically

  // Get messages reactively from events store - this will update when new messages are added
  const eventsMap = usePrivateMessagesStore((state) => state.events)
  console.warn("Rendering chat with ID:", id, eventsMap)
  const messages = eventsMap.get(id) ?? new SortedMap<string, MessageType>([], comparator)

  useEffect(() => {
    if (!id) {
      return
    }

    if (!messages) return

    const myPubKey = useUserStore.getState().publicKey
    Array.from(messages.entries()).forEach(([, message]) => {
      if (!haveReply && message.pubkey !== myPubKey) {
        setHaveReply(true)
      }
      if (!haveSent && message.pubkey === myPubKey) {
        setHaveSent(true)
      }
    })
  }, [id, messages, haveReply, haveSent])

  useEffect(() => {
    if (!id) return

    updateLastSeen(id)

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateLastSeen(id)
      }
    }

    const handleFocus = () => {
      updateLastSeen(id)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [id, updateLastSeen])

  const handleSendReaction = async (messageId: string, emoji: string) => {
    const myPubKey = useUserStore.getState().publicKey
    if (!myPubKey) return

    const event = {
      kind: KIND_REACTION,
      content: emoji,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["e", messageId],
        ["ms", String(Date.now())],
      ],
    }

    // TODO: actually do somethign
  }

  if (!id) {
    return null
  }

  return (
    <>
      <PrivateChatHeader id={id} messages={messages} />
      <ChatContainer
        messages={messages}
        sessionId={id}
        onReply={setReplyingTo}
        onSendReaction={handleSendReaction}
      />
      <MessageForm id={id} replyingTo={replyingTo} setReplyingTo={setReplyingTo} />
    </>
  )
}

export default Chat
