import {useState} from "react"
import {useParams} from "@/navigation"
import {useGroupsStore} from "@/stores/groups"
import {usePrivateMessagesStore} from "@/stores/privateMessages"
import {useUserStore} from "@/stores/user"
import ChatContainer from "../components/ChatContainer"
import MessageForm from "../message/MessageForm"
import GroupChatHeader from "./GroupChatHeader"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {MessageType} from "../message/Message"
import {comparator} from "../utils/messageGrouping"
import {KIND_REACTION} from "@/utils/constants"

const GroupChatPage = () => {
  const params = useParams()
  const id = params.id || ""
  const {groups} = useGroupsStore()
  const group = id ? groups[id] : undefined
  // Fix: Use the events store with proper subscription to get reactive updates
  const {events} = usePrivateMessagesStore()
  const myPubKey = useUserStore((state) => state.publicKey)
  const [replyingTo, setReplyingTo] = useState<MessageType | undefined>(undefined)

  if (!id || !group) {
    return <div className="p-4">Group not found</div>
  }

  const messages = events.get(id) ?? new SortedMap<string, MessageType>([], comparator)

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !myPubKey) return
    const messageEvent = {
      kind: 0,
      content,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["l", group.id],
        ["ms", String(Date.now())],
      ],
    }

    //TODO: Implement sendMessage function to handle optimistic UI update and sending
    // Send to all group members
    // For ourselves, the optimistic update in sendMessage will handle display
    // For others, we need to actually send the message
    void messageEvent
  }

  const handleSendReaction = async (messageId: string, emoji: string) => {
    if (!myPubKey) return

    const reactionEvent = {
      kind: KIND_REACTION,
      content: emoji,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["e", messageId],
        ["l", group.id],
        ["ms", String(Date.now())],
      ],
    }

    // Send reaction to all group members including self for multi-device support
    // TODO: once delivery is available, dispatch reactionEvent to members
    void reactionEvent
  }

  return (
    <>
      <GroupChatHeader groupId={id} />
      <ChatContainer
        messages={messages}
        sessionId={id}
        onReply={setReplyingTo}
        showAuthor={true}
        isPublicChat={false}
        onSendReaction={handleSendReaction}
      />
      <MessageForm
        id={id}
        onSendMessage={handleSendMessage}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
      />
    </>
  )
}

export default GroupChatPage
