import {useState} from "react"
import {useLocation} from "@/navigation"
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
  const location = useLocation()
  // Extract group ID from pathname: /chats/group/:id
  const pathSegments = location.pathname.split("/").filter(Boolean)
  const id = pathSegments[2] || ""

  const groups = useGroupsStore((state) => state.groups)
  const group = id ? groups[id] : undefined
  const {events} = usePrivateMessagesStore()
  const myPubKey = useUserStore((state) => state.publicKey)
  const [replyingTo, setReplyingTo] = useState<MessageType | undefined>(undefined)

  if (!id || !group) {
    return <div className="p-4">Group not found</div>
  }

  const messages = events.get(id) ?? new SortedMap<string, MessageType>([], comparator)

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !myPubKey) return

    try {
      const sessionManager = (await import("@/shared/services/PrivateChats")).getSessionManager()
      if (!sessionManager) {
        console.error("Session manager not available")
        return
      }

      const messageEvent = {
        id: crypto.randomUUID(),
        pubkey: myPubKey,
        kind: 0,
        content,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["l", group.id],
          ["ms", String(Date.now())],
        ],
      }

      // Send to all group members (excluding self)
      await Promise.all(
        group.members
          .filter((memberPubKey) => memberPubKey !== myPubKey)
          .map((memberPubKey) => sessionManager.sendEvent(memberPubKey, messageEvent))
      )

      // Store message locally for immediate display
      await usePrivateMessagesStore.getState().upsert(id, myPubKey, messageEvent)
    } catch (error) {
      console.error("Failed to send group message:", error)
    }
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
