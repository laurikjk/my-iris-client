import {initializeChat} from "@/services/sessionManager"
import ChatContainer from "../components/ChatContainer"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {comparator} from "../utils/messageGrouping"
import PrivateChatHeader from "./PrivateChatHeader"
import {useState, useMemo, useEffect} from "react"
import MessageForm from "../message/MessageForm"
import {MessageType} from "../message/Message"
import {useEventsStore} from "@/stores/events"

const Chat = ({id}: {id: string}) => {
  const [replyingTo, setReplyingTo] = useState<MessageType | undefined>(undefined)
  const events = useEventsStore((state) => state.events)

  // id is the recipient's pubkey
  const recipientPubKey = id

  useEffect(() => {
    // Initialize chat session
    initializeChat(recipientPubKey)
  }, [recipientPubKey])

  // Get messages for this chat from events store
  const messagesMemo = useMemo(() => {
    const chatMessages = events.get(recipientPubKey)
    return chatMessages || new SortedMap<string, MessageType>([], comparator)
  }, [events, recipientPubKey])


  if (!recipientPubKey) {
    return null
  }

  return (
    <>
      <PrivateChatHeader id={recipientPubKey} messages={messagesMemo} />
      <ChatContainer
        messages={messagesMemo}
        sessionId={recipientPubKey}
        onReply={setReplyingTo}
      />
      <MessageForm
        id={recipientPubKey}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
      />
    </>
  )
}

export default Chat
