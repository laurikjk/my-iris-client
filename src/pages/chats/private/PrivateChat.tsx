import ChatContainer from "../components/ChatContainer"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {comparator} from "../utils/messageGrouping"
import PrivateChatHeader from "./PrivateChatHeader"
import {usePrivateChatsStore} from "@/stores/privateChats"
import MessageForm from "../message/MessageForm"
import {MessageType} from "../message/Message"
import {useEffect, useState} from "react"

const Chat = ({id}: {id: string}) => {
  // id is now userPubKey instead of sessionId
  const {getMessages, updateLastSeen, getUserSessions} = usePrivateChatsStore()
  const [haveReply, setHaveReply] = useState(false)
  const [haveSent, setHaveSent] = useState(false)
  const [replyingTo, setReplyingTo] = useState<MessageType | undefined>(undefined)

  // Get all sessions for this user
  const userSessions = getUserSessions(id)
  const hasAnySessions = userSessions.length > 0

  useEffect(() => {
    if (!id || !hasAnySessions) {
      return
    }

    const messages = getMessages(id)
    if (!messages) return

    Array.from(messages.entries()).forEach(([, message]) => {
      if (!haveReply && message.pubkey !== "user") {
        setHaveReply(true)
      }
      if (!haveSent && message.pubkey === "user") {
        setHaveSent(true)
      }
    })
  }, [id, getMessages, haveReply, haveSent, hasAnySessions])

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

  if (!id) {
    return null
  }

  const messages = getMessages(id) ?? new SortedMap<string, MessageType>([], comparator)

  return (
    <>
      <PrivateChatHeader id={id} messages={messages} />
      <ChatContainer messages={messages} sessionId={id} onReply={setReplyingTo} />
      <MessageForm id={id} replyingTo={replyingTo} setReplyingTo={setReplyingTo} />
    </>
  )
}

export default Chat
