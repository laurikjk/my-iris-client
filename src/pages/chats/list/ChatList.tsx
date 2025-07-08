import {getMillisecondTimestamp} from "nostr-double-ratchet/src"
import {usePublicChatsStore} from "@/stores/publicChats"
import Header from "@/shared/components/header/Header"
import {useSessionsStore} from "@/stores/sessions"
import {useEventsStore} from "@/stores/events"
import {useUserStore} from "@/stores/user"
import ChatListItem from "./ChatListItem"
import {NavLink} from "react-router"
import classNames from "classnames"
import {useEffect} from "react"

interface ChatListProps {
  className?: string
}

const ChatList = ({className}: ChatListProps) => {
  const {sessions} = useSessionsStore()
  const {events} = useEventsStore()
  const {publicChats, timestamps, fetchPublicChats} = usePublicChatsStore()
  const myPubKey = useUserStore((state) => state.publicKey)

  // Refresh public chat metadata on mount
  useEffect(() => {
    if (!myPubKey) return
    fetchPublicChats()
  }, [myPubKey, fetchPublicChats])

  // Combine private and public chats for display
  const allChats = Object.values(
    [
      ...Array.from(sessions)
        .filter(([, session]) => !!session) //&& !session.state.deleted)
        .map(([id]) => ({id, isPublic: false})),
      ...Array.from(publicChats.keys()).map((chatId) => ({id: chatId, isPublic: true})),
    ].reduce(
      (acc, chat) => {
        // If chat has empty string as id, skip it (appears on recursion depth 3 on sessions)
        if (chat.id === "") {
          return acc
        }
        // If chat doesn't exist or current chat is newer, update it
        if (!acc[chat.id] || (chat.isPublic && !acc[chat.id].isPublic)) {
          acc[chat.id] = chat
        }
        return acc
      },
      {} as Record<string, {id: string; isPublic: boolean}>
    )
  )

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
