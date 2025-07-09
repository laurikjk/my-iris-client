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

  const allChats = Object.values([
    ...Array.from(sessions).map(([id]) => ({id, isPublic: false})),
    ...Array.from(publicChats.keys()).map((chatId) => ({id: chatId, isPublic: true})),
  ])

  // Sort all chats by most recent activity
  const sortedChats = allChats.sort((a, b) => {
    // Get latest message time for chat A
    let aLatest = 0
    if (a.isPublic) {
      aLatest = (timestamps.get(a.id) || 0) * 1000
    } else {
      aLatest = 0
      const [, latest] = events.get(a.id)?.last() ?? []
      if (latest) {
        aLatest = getMillisecondTimestamp(latest)
      }
    }

    // Get latest message time for chat B
    let bLatest = 0
    if (b.isPublic) {
      bLatest = (timestamps.get(b.id) || 0) * 1000
    } else {
      bLatest = 0
      const [, latest] = events.get(b.id)?.last() ?? []
      if (latest) {
        bLatest = getMillisecondTimestamp(latest)
      }
    }

    // Sort in descending order (newest first)
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
