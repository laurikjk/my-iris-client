import {getMillisecondTimestamp} from "nostr-double-ratchet/src"
import {usePublicChatsStore} from "@/stores/publicChats"
import Header from "@/shared/components/header/Header"
import {useSessionsStore} from "@/stores/sessions"
import {useEventsStore} from "@/stores/events"
import ChatListItem from "./ChatListItem"
import {NavLink} from "react-router"
import classNames from "classnames"
import {useEffect} from "react"
import { useGroupsStore } from "@/stores/groups"

interface ChatListProps {
  className?: string
}

const ChatList = ({className}: ChatListProps) => {
  const {sessions} = useSessionsStore()
  const {events} = useEventsStore()
  const {publicChats, timestamps, addOrRefreshChatById} = usePublicChatsStore()
  const { groups } = useGroupsStore()

  useEffect(() => {
    Object.keys(publicChats).forEach((chatId) => {
      const chat = publicChats[chatId]
      if (!chat.metadata) {
        addOrRefreshChatById(chatId)
      }
    })
  }, [publicChats, addOrRefreshChatById])

  const latestForGroup = (id: string) => {
    const groupEvents = events.get(id)
    if (!groupEvents) return 0
    const lastMsg = groupEvents.last()?.[1]
    if (!lastMsg) return 0
    return lastMsg.created_at ? new Date(lastMsg.created_at * 1000).getTime() : 0
  }

  const latestForPublicChat = (id: string) => {
    const latest = timestamps[id] || 0
    return latest * 1000
  }

  const latestForPrivateChat = (id: string) => {
    const [, latest] = events.get(id)?.last() ?? []
    return latest ? getMillisecondTimestamp(latest) : 0
  }

  const allChatItems = [
    ...Object.values(groups).map((group) => ({ id: group.id, type: 'group' })),
    ...Array.from(sessions.keys()).map((chatId) => ({ id: chatId, type: 'private' })),
    ...Object.keys(publicChats).map((chatId) => ({ id: chatId, type: 'public' })),
  ].sort((a, b) => {
    const aLatest = groups[a.id]
      ? latestForGroup(a.id)
      : publicChats[a.id]
      ? latestForPublicChat(a.id)
      : latestForPrivateChat(a.id)
    const bLatest = groups[b.id]
      ? latestForGroup(b.id)
      : publicChats[b.id]
      ? latestForPublicChat(b.id)
      : latestForPrivateChat(b.id)
    return bLatest - aLatest
  })

  return (
    <nav className={className}>
      <div className="md:hidden">
        <Header title="Chats" slideUp={false} />
      </div>
      <div className="flex flex-col">
        <NavLink
          to="/chats/new"
          end
          className={({isActive}) =>
            classNames("p-4 flex items-center border-b border-custom", {
              "bg-base-300": isActive,
              "hover:bg-base-300": !isActive,
            })
          }
        >
          <div className="flex flex-col">
            <span className="text-base font-semibold">New Chat</span>
            <span className="text-sm text-base-content/70">Start a new conversation</span>
          </div>
        </NavLink>
        {allChatItems.map(({id, type}) => (
          <ChatListItem key={id} id={id} isPublic={type === 'public'} />
        ))}
      </div>
    </nav>
  )
}

export default ChatList
