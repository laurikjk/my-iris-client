import {useState} from "react"
import {useParams} from "react-router"
import {useGroupsStore} from "@/stores/groups"
import {useEventsStore} from "@/stores/events"
import {useUserStore} from "@/stores/user"
import {useSessionsStore} from "@/stores/sessions"
import ChatContainer from "../components/ChatContainer"
import MessageForm from "../message/MessageForm"
import GroupChatHeader from "./GroupChatHeader"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {MessageType} from "../message/Message"
import {comparator} from "../utils/messageGrouping"

const GroupChatPage = () => {
  const params = useParams()
  const id = params.id || ""
  const {groups} = useGroupsStore()
  const group = id ? groups[id] : undefined
  // Fix: Use the events store with proper subscription to get reactive updates
  const {events} = useEventsStore()
  const myPubKey = useUserStore((state) => state.publicKey)
  const {sendToUser} = useSessionsStore()
  const [replyingTo, setReplyingTo] = useState<MessageType | undefined>(undefined)

  if (!id || !group) {
    return <div className="p-4">Group not found</div>
  }

  const messages = events.get(id) ?? new SortedMap<string, MessageType>([], comparator)

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !myPubKey) return
    const event = {
      kind: 0,
      content,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["l", group.id],
        ["ms", String(Date.now())],
      ],
    }

    // Send to all group members except self
    await Promise.all(
      group.members
        .filter((pubkey: string) => pubkey !== myPubKey)
        .map((pubkey: string) => sendToUser(pubkey, event))
    )
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
      />
      <MessageForm
        id={id}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        onSendMessage={handleSendMessage}
        isPublicChat={false}
      />
    </>
  )
}

export default GroupChatPage
