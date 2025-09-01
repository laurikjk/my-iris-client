import {ConnectionStatus} from "@/shared/components/connection/ConnectionStatus"
import RelativeTime from "@/shared/components/event/RelativeTime"
import {getMillisecondTimestamp} from "nostr-double-ratchet/src"
import {usePublicChatsStore} from "@/stores/publicChats"
import {Avatar} from "@/shared/components/user/Avatar"
import ProxyImg from "@/shared/components/ProxyImg"
import {shouldHideUser} from "@/utils/visibility"
import {Name} from "@/shared/components/user/Name"
import {KIND_CHANNEL_MESSAGE, KIND_CHANNEL_CREATE} from "@/utils/constants"
import {useLocation, NavLink} from "@/navigation"
import {MessageType} from "../message/Message"
import {usePrivateMessagesStore} from "@/stores/privateMessages"
import {RiEarthLine} from "@remixicon/react"
import {useUserStore} from "@/stores/user"
import {useEffect, useState} from "react"
import debounce from "lodash/debounce"
import classNames from "classnames"
import {ndk} from "@/utils/ndk"
import {useGroupsStore} from "@/stores/groups"
import {usePrivateChatsStore} from "@/stores/privateChatsNew"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {comparator} from "@/pages/chats/utils/messageGrouping"

interface ChatListItemProps {
  id: string
  isPublic?: boolean
  type?: string
}

const ChatListItem = ({id, isPublic = false, type}: ChatListItemProps) => {
  const location = useLocation()
  const pubKey = isPublic ? "" : id
  const isActive = location.state?.id === id
  const [latestMessage, setLatestMessage] = useState<{
    content: string
    created_at: number
    pubkey: string
    kind: number
  } | null>(null)
  const [showPlaceholder, setShowPlaceholder] = useState(false)
  const {events} = usePrivateMessagesStore()
  const {
    publicChats,
    lastSeen: lastSeenPublic,
    updateLastSeen: updateLastSeenPublic,
    updateTimestamp,
  } = usePublicChatsStore()
  const myPubKey = useUserStore((state) => state.publicKey)
  const {groups} = useGroupsStore()
  const {getChatsList} = usePrivateChatsStore()
  const group = groups[id]

  const chat = isPublic ? publicChats[id] : null

  // For private chats, get aggregated messages from all sessions
  const privateMessages =
    type === "private" ? (events.get(id) ?? new SortedMap([], comparator)) : null
  const [, latest] = privateMessages?.last() ?? []

  // For groups, get messages normally
  const groupMessages = type === "group" ? events.get(id) : null
  const [, groupLatest] = groupMessages?.last() ?? []

  // Choose the appropriate latest message
  const actualLatest = type === "group" ? groupLatest : latest

  // Get chat data for unread counts
  const chatsList = getChatsList()
  const chatData = chatsList.find((c) => c.userPubKey === id)

  const lastSeenPrivateTime = chatData?.lastMessage?.created_at
    ? chatData.lastMessage.created_at * 1000
    : 0
  const lastSeenPublicTime = lastSeenPublic[id] || 0

  useEffect(() => {
    if (!isPublic) return

    let latestMessageInMemory: {
      content: string
      created_at: number
      pubkey: string
      kind: number
    } | null = null

    const debouncedUpdate = debounce(() => {
      if (latestMessageInMemory) {
        setLatestMessage(latestMessageInMemory)
        updateTimestamp(id, latestMessageInMemory.created_at)
      }
    }, 300)

    const sub = ndk().subscribe({
      kinds: [KIND_CHANNEL_MESSAGE],
      "#e": [id],
      limit: 1,
    })

    sub.on("event", (event) => {
      if (!event || !event.id) return
      if (shouldHideUser(event.pubkey)) return
      if (!latestMessageInMemory || event.created_at > latestMessageInMemory.created_at) {
        latestMessageInMemory = {
          content: event.content,
          created_at: event.created_at,
          pubkey: event.pubkey,
          kind: event.kind,
        }
        debouncedUpdate()
      }
    })

    return () => {
      sub.stop()
      debouncedUpdate.cancel()
    }
  }, [id, isPublic, updateTimestamp])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!chat) {
        setShowPlaceholder(true)
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [chat])

  const getGroupInvitePreview = (pubkey: string, isCurrentUser: boolean) => {
    return (
      <span className="italic">
        {isCurrentUser ? (
          "You created the group"
        ) : (
          <>
            <Name pubKey={pubkey} /> added you to the group
          </>
        )}
      </span>
    )
  }

  const getPreviewContent = () => {
    if (isPublic && latestMessage?.content) {
      // Show special preview for group invite messages
      if (latestMessage.kind === KIND_CHANNEL_CREATE) {
        return getGroupInvitePreview(
          latestMessage.pubkey,
          latestMessage.pubkey === myPubKey
        )
      }
      const content = latestMessage.content
      return content.length > 30 ? content.slice(0, 30) + "..." : content
    }

    if (actualLatest?.content) {
      // Show special preview for group invite messages
      if (actualLatest.kind === KIND_CHANNEL_CREATE) {
        return getGroupInvitePreview(
          actualLatest.pubkey,
          actualLatest.pubkey === myPubKey
        )
      }
      const content = actualLatest.content
      return content.length > 30 ? content.slice(0, 30) + "..." : content
    }

    return ""
  }

  const previewContent = getPreviewContent()

  // Avatar rendering
  let avatar
  if (group) {
    if (group.picture) {
      avatar = (
        <ProxyImg
          width={18}
          square={true}
          src={group.picture}
          alt="Group Icon"
          className="rounded-full w-10 h-10"
        />
      )
    } else {
      avatar = (
        <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center">
          <span className="text-lg">👥</span>
        </div>
      )
    }
  } else if (isPublic) {
    if (chat?.picture) {
      avatar = (
        <ProxyImg
          width={18}
          square={true}
          src={chat.picture}
          alt="Channel Icon"
          className="rounded-full w-10 h-10"
        />
      )
    } else {
      avatar = (
        <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center">
          <span className="text-lg">#</span>
        </div>
      )
    }
  } else {
    avatar = <Avatar pubKey={pubKey} />
  }

  // Name/title rendering
  let title
  if (group) {
    title = group.name
  } else if (isPublic) {
    if (chat?.name) {
      title = (
        <>
          <RiEarthLine className="w-4 h-4" />
          {chat.name}
        </>
      )
    } else if (showPlaceholder) {
      title = (
        <>
          <RiEarthLine className="w-4 h-4" />
          {`Channel ${id.slice(0, 8)}...`}
        </>
      )
    } else {
      title = <RiEarthLine className="w-4 h-4" />
    }
  } else {
    title = <Name pubKey={pubKey} />
  }

  // Unread badge logic
  let unreadBadge = null
  if (isPublic) {
    if (latestMessage?.created_at && latestMessage.pubkey !== myPubKey) {
      const hasUnread = latestMessage.created_at * 1000 > lastSeenPublicTime
      if (!lastSeenPublicTime || hasUnread) {
        unreadBadge = <div className="indicator-item badge badge-primary badge-xs" />
      }
    }
  } else if (!group) {
    if (actualLatest?.created_at && actualLatest.pubkey !== myPubKey) {
      const hasUnread =
        getMillisecondTimestamp(actualLatest as MessageType) > lastSeenPrivateTime
      if (!lastSeenPrivateTime || hasUnread) {
        unreadBadge = <div className="indicator-item badge badge-primary badge-xs" />
      }
    }
  }

  // Determine route for NavLink
  let chatRoute
  if (group) {
    chatRoute = `/chats/group/${id}`
  } else if (isPublic) {
    chatRoute = `/chats/${id}`
  } else {
    // For private chats, id is now userPubKey
    chatRoute = "/chats/chat"
  }

  return (
    <NavLink
      to={chatRoute}
      state={{id}}
      key={id}
      onClick={() => isPublic && updateLastSeenPublic(id)}
      className={classNames("px-2 py-4 flex items-center border-b border-custom", {
        "bg-base-300": isActive,
        "hover:bg-base-300": !isActive,
      })}
    >
      <div className="flex flex-row items-center gap-2 flex-1">
        {avatar}
        <div className="flex flex-col flex-1">
          <div className="flex flex-row items-center justify-between gap-2">
            <span className="text-base font-semibold flex items-center gap-1">
              {title}
            </span>
            <div className="flex flex-col gap-2">
              {(isPublic ? latestMessage?.created_at : actualLatest?.created_at) && (
                <span className="text-sm text-base-content/70 ml-2">
                  <RelativeTime
                    from={(() => {
                      if (isPublic && latestMessage?.created_at) {
                        return latestMessage.created_at * 1000
                      } else {
                        return getMillisecondTimestamp(actualLatest as MessageType)
                      }
                    })()}
                  />
                </span>
              )}
              {!isPublic && !group && <ConnectionStatus peerId={id} />}
            </div>
          </div>
          <div className="flex flex-row items-center justify-between gap-2">
            <span className="text-sm text-base-content/70 min-h-[1.25rem]">
              {previewContent}
            </span>
            {unreadBadge}
          </div>
        </div>
      </div>
    </NavLink>
  )
}

export default ChatListItem
