import ChatContainer from "../components/ChatContainer"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {comparator} from "../utils/messageGrouping"
import PrivateChatHeader from "./PrivateChatHeader"
import {usePrivateChatsStore} from "@/stores/privateChatsNew"
import {usePrivateMessagesStore} from "@/stores/privateMessages"
import MessageForm from "../message/MessageForm"
import {MessageType} from "../message/Message"
import {useEffect, useState} from "react"
import {useUserRecordsStore} from "@/stores/userRecords"
import {useUserStore} from "@/stores/user"
import {KIND_REACTION} from "@/utils/constants"

const Chat = ({id}: {id: string}) => {
  // id is now userPubKey instead of sessionId
  const {updateLastSeen} = usePrivateChatsStore()
  const [haveReply, setHaveReply] = useState(false)
  const [haveSent, setHaveSent] = useState(false)
  const [replyingTo, setReplyingTo] = useState<MessageType | undefined>(undefined)

  // Get all sessions for this user
  const sessions = useUserRecordsStore((state) => state.sessions)
  const userSessions = Array.from(sessions.keys()).filter((sessionId) =>
    sessionId.startsWith(`${id}:`)
  )
  const hasAnySessions = userSessions.length > 0

  // Get messages reactively from events store - this will update when new messages are added
  const eventsMap = usePrivateMessagesStore((state) => state.events)
  const messages = eventsMap.get(id) ?? new SortedMap<string, MessageType>([], comparator)

  useEffect(() => {
    if (!id || !hasAnySessions) {
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
  }, [id, messages, haveReply, haveSent, hasAnySessions])

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

  const {sendToUser} = useUserRecordsStore()

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
