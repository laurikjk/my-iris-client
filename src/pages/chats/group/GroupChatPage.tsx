import {useState, useEffect, useCallback} from "react"
import {useLocation} from "@/navigation"
import {useGroupsStore} from "@/stores/groups"
import {usePrivateMessagesStore} from "@/stores/privateMessages"
import ChatContainer from "../components/ChatContainer"
import MessageForm from "../message/MessageForm"
import GroupChatHeader from "./GroupChatHeader"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {MessageType} from "../message/Message"
import {comparator} from "../utils/messageGrouping"
import {getMillisecondTimestamp} from "nostr-double-ratchet/src"

const GroupChatPage = () => {
  const location = useLocation()
  // Extract group ID from pathname: /chats/group/:id
  const pathSegments = location.pathname.split("/").filter(Boolean)
  const id = pathSegments[2] || ""

  const groups = useGroupsStore((state) => state.groups)
  const group = id ? groups[id] : undefined
  const {events} = usePrivateMessagesStore()
  const updateLastSeen = usePrivateMessagesStore((state) => state.updateLastSeen)
  const [replyingTo, setReplyingTo] = useState<MessageType | undefined>(undefined)

  if (!id || !group) {
    return <div className="p-4">Group not found</div>
  }

  const messages = events.get(id) ?? new SortedMap<string, MessageType>([], comparator)
  const lastMessageEntry = messages.last()
  const lastMessage = lastMessageEntry ? lastMessageEntry[1] : undefined
  const lastMessageTimestamp = lastMessage ? getMillisecondTimestamp(lastMessage) : undefined

  const markGroupOpened = useCallback(() => {
    if (!id) return
    const currentEvents = usePrivateMessagesStore.getState().events
    const latestMessage = currentEvents.get(id)?.last()?.[1]
    const latestTimestamp = latestMessage ? getMillisecondTimestamp(latestMessage) : undefined
    const targetTimestamp = Math.max(Date.now(), latestTimestamp ?? 0)
    const current = usePrivateMessagesStore.getState().lastSeen.get(id) || 0
    if (targetTimestamp > current) {
      updateLastSeen(id, targetTimestamp)
    }
  }, [id, updateLastSeen])

  useEffect(() => {
    if (!id) return

    markGroupOpened()

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markGroupOpened()
      }
    }

    const handleFocus = () => {
      markGroupOpened()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [id, markGroupOpened])

  useEffect(() => {
    if (!id || lastMessageTimestamp === undefined) return
    const existing = usePrivateMessagesStore.getState().lastSeen.get(id) || 0
    if (lastMessageTimestamp > existing) {
      updateLastSeen(id, lastMessageTimestamp)
    }
  }, [id, lastMessageTimestamp, updateLastSeen])

  return (
    <>
      <GroupChatHeader groupId={id} />
      <ChatContainer
        messages={messages}
        sessionId={id}
        onReply={setReplyingTo}
        showAuthor={true}
        isPublicChat={false}
        groupId={id}
        groupMembers={group.members}
      />
      <MessageForm
        id={id}
        groupId={group.id}
        groupMembers={group.members}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
      />
    </>
  )
}

export default GroupChatPage
