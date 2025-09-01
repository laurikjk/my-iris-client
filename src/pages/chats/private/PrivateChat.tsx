import ChatContainer from "../components/ChatContainer"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {comparator} from "../utils/messageGrouping"
import PrivateChatHeader from "./PrivateChatHeader"
import {usePrivateChatsStoreNew} from "@/stores/privateChats.new"
import MessageForm from "../message/MessageForm"
import {MessageType} from "../message/Message"
import {useEffect, useState} from "react"
import {useUserStore} from "@/stores/user"
import {KIND_REACTION} from "@/utils/constants"

// Create a stable empty map to avoid recreating on every render
const EMPTY_MESSAGES = new SortedMap<string, MessageType>([], comparator)

const Chat = ({id}: {id: string}) => {
  // id is now userPubKey instead of sessionId
  const {updateLastSeen, startListeningToUser, sendToUser} = usePrivateChatsStoreNew()
  const [haveReply, setHaveReply] = useState(false)
  const [haveSent, setHaveSent] = useState(false)
  const [replyingTo, setReplyingTo] = useState<MessageType | undefined>(undefined)

  // Get messages reactively from new store - use a stable selector
  const messages = usePrivateChatsStoreNew(
    (state) => {
      if (!id) return null
      return state.messages.get(id) || null
    },
    (a, b) => a === b // Shallow comparison - only re-render if the actual map instance changes
  )

  // Use stable reference for empty messages
  const safeMessages = messages || EMPTY_MESSAGES

  useEffect(() => {
    if (!id) {
      return
    }

    if (!safeMessages) return

    const myPubKey = useUserStore.getState().publicKey
    Array.from(safeMessages.entries()).forEach(([, message]) => {
      if (!haveReply && message.pubkey !== myPubKey) {
        setHaveReply(true)
      }
      if (!haveSent && message.pubkey === myPubKey) {
        setHaveSent(true)
      }
    })
  }, [id, safeMessages, haveReply, haveSent])

  useEffect(() => {
    if (!id) return

    // Initialize SessionManager for this user (automatically fetch invites and create sessions)
    startListeningToUser(id)
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
  }, [id, updateLastSeen, startListeningToUser])

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

    await sendToUser(id, event)
  }

  if (!id) {
    return null
  }

  return (
    <>
      <PrivateChatHeader id={id} messages={safeMessages} />
      <ChatContainer
        messages={safeMessages}
        sessionId={id}
        onReply={setReplyingTo}
        onSendReaction={handleSendReaction}
      />
      <MessageForm id={id} replyingTo={replyingTo} setReplyingTo={setReplyingTo} />
    </>
  )
}

export default Chat
