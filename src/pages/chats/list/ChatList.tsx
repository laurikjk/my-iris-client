import {getMillisecondTimestamp} from "nostr-double-ratchet/src"
import {usePublicChatsStore} from "@/stores/publicChats"
import Header from "@/shared/components/header/Header"
import {useSessionsStore} from "@/stores/sessions"
import {useEventsStore} from "@/stores/events"
import ChatListItem from "./ChatListItem"
import {NavLink} from "react-router"
import classNames from "classnames"

interface ChatListProps {
  className?: string
}

const ChatList = ({className}: ChatListProps) => {
  const {sessions} = useSessionsStore()
  const {events} = useEventsStore()
  const {publicChats, timestamps} = usePublicChatsStore()

  const allChatItems = Object.values([
    ...Array.from(sessions).map(([id]) => ({id, isPublic: false})),
    ...Array.from(publicChats.keys()).map((chatId) => ({id: chatId, isPublic: true})),
  ])

  const latestForPublicChat = (id: string) => {
    const latest = timestamps.get(id) || 0
    return latest * 1000
  }

  const latestForPrivateChat = (id: string) => {
    const [, latest] = events.get(id)?.last() ?? []
    return latest ? getMillisecondTimestamp(latest) : 0
  }

  const sortedChats = allChatItems.sort((a, b) => {
    const aLatest = a.isPublic ? latestForPublicChat(a.id) : latestForPrivateChat(a.id)
    const bLatest = b.isPublic ? latestForPublicChat(b.id) : latestForPrivateChat(b.id)
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
        {sortedChats.map(({id, isPublic}) => (
          <ChatListItem key={id} id={id} isPublic={isPublic} />
        ))}
      </div>
    </nav>
  )
}

export default ChatList
