import {ConnectionStatus} from "@/shared/components/connection/ConnectionStatus"
import RelativeTime from "@/shared/components/event/RelativeTime"
import {getMillisecondTimestamp} from "nostr-double-ratchet/src"
import {useLocalState} from "irisdb-hooks/src/useLocalState"
import Header from "@/shared/components/header/Header"
import {Avatar} from "@/shared/components/user/Avatar"
import ProxyImg from "@/shared/components/ProxyImg"
import {Name} from "@/shared/components/user/Name"
import {NavLink, useLocation} from "react-router"
import {RiEarthLine} from "@remixicon/react"
import {useEffect, useState} from "react"
import {localState} from "irisdb/src"
import {MessageType} from "./Message"
import classNames from "classnames"
import {ndk} from "@/utils/ndk"

interface ChatListProps {
  className?: string
}

type Session = {
  messages: string[]
  deleted?: boolean
  latest?: {
    time: number
    content: string
  }
}

// NIP-28 event kinds
const CHANNEL_CREATE = 40
const CHANNEL_MESSAGE = 42

type ChannelMetadata = {
  name: string
  about: string
  picture: string
  relays: string[]
}

type PublicChat = {
  id: string
  name: string
  picture?: string
  latestMessage?: {
    content: string
    created_at: number
  }
}

const ChatListItem = ({id, isPublic = false}: {id: string; isPublic?: boolean}) => {
  const location = useLocation()
  const pubKey = isPublic ? "" : id.split(":").shift() || ""
  const isActive = location.state?.id === id
  const [channelMetadata, setChannelMetadata] = useState<ChannelMetadata | null>(null)
  const [latestMessage, setLatestMessage] = useState<{
    content: string
    created_at: number
  } | null>(null)

  useEffect(() => {
    // TODO irisdb should have subscriptions work without this
    if (!isPublic) {
      localState.get(`sessions/${id}`).get("latest").put({})
    }
  }, [id, isPublic])

  const [latest] = useLocalState(`sessions/${id}/latest`, {} as MessageType)
  const [lastSeen, setLastSeen] = useLocalState(`sessions/${id}/lastSeen`, 0)
  const [deleted] = useLocalState(`sessions/${id}/deleted`, false)

  // Fetch channel metadata for public chats
  useEffect(() => {
    if (isPublic) {
      const fetchChannelMetadata = async () => {
        try {
          const channelEvent = await ndk().fetchEvent({
            kinds: [CHANNEL_CREATE],
            ids: [id],
          })

          if (channelEvent) {
            try {
              const metadata = JSON.parse(channelEvent.content)
              setChannelMetadata(metadata)
            } catch (e) {
              console.error("Failed to parse channel creation content:", e)
            }
          }
        } catch (err) {
          console.error("Error fetching channel metadata:", err)
        }
      }

      fetchChannelMetadata()
    }
  }, [id, isPublic])

  // Fetch latest message for public chats
  useEffect(() => {
    if (!isPublic) return

    const fetchLatestMessage = async () => {
      try {
        // Fetch the most recent message in this channel
        const events = await ndk().fetchEvents({
          kinds: [CHANNEL_MESSAGE],
          "#e": [id],
          limit: 1,
        })

        const eventArray = Array.from(events)
        if (eventArray.length > 0) {
          const event = eventArray[0]
          setLatestMessage({
            content: event.content,
            created_at: event.created_at,
          })
        }
      } catch (err) {
        console.error("Error fetching latest message:", err)
      }
    }

    fetchLatestMessage()
  }, [id, isPublic])

  const getPreviewText = () => {
    if (isPublic && latestMessage?.content) {
      const content = latestMessage.content
      return content.length > 30 ? content.slice(0, 30) + "..." : content
    }

    if (latest?.content) {
      const content = latest.content
      return content.length > 30 ? content.slice(0, 30) + "..." : content
    }

    return ""
  }

  const previewText = getPreviewText()

  if (deleted && !isPublic) return null

  return (
    <NavLink
      to={isPublic ? `/chats/${id}` : "/chats/chat"}
      state={{id}}
      key={id}
      onClick={() => setLastSeen(Date.now())}
      className={classNames("px-2 py-4 flex items-center border-b border-custom", {
        "bg-base-300": isActive,
        "hover:bg-base-300": !isActive,
      })}
    >
      <div className="flex flex-row items-center gap-2 flex-1">
        {isPublic &&
          (channelMetadata?.picture ? (
            <ProxyImg
              width={18}
              square={true}
              src={channelMetadata.picture}
              alt="Channel Icon"
              className="rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center">
              <span className="text-lg">#</span>
            </div>
          ))}
        {!isPublic && <Avatar pubKey={pubKey} />}
        <div className="flex flex-col flex-1">
          <div className="flex flex-row items-center justify-between gap-2">
            <span className="text-base font-semibold flex items-center gap-1">
              {isPublic && <RiEarthLine className="w-4 h-4" />}
              {isPublic ? (
                channelMetadata?.name || `Channel ${id.slice(0, 8)}...`
              ) : (
                <Name pubKey={pubKey} />
              )}
            </span>
            <div className="flex flex-col gap-2">
              {(isPublic ? latestMessage?.created_at : latest?.created_at) && (
                <span className="text-sm text-base-content/70 ml-2">
                  <RelativeTime
                    from={
                      isPublic && latestMessage?.created_at
                        ? latestMessage.created_at * 1000
                        : getMillisecondTimestamp(latest)
                    }
                  />
                </span>
              )}
              {!isPublic && <ConnectionStatus peerId={id} />}
            </div>
          </div>
          <div className="flex flex-row items-center justify-between gap-2">
            <span className="text-sm text-base-content/70 min-h-[1.25rem]">
              {previewText}
            </span>
            {(() => {
              if (isPublic) {
                if (!latestMessage?.created_at) return null
                const hasUnread = latestMessage.created_at * 1000 > lastSeen
                return (
                  (!lastSeen || hasUnread) && (
                    <div className="indicator-item badge badge-primary badge-xs"></div>
                  )
                )
              } else {
                if (!latest?.created_at) return null
                const hasUnread = getMillisecondTimestamp(latest) > lastSeen
                return (
                  (!lastSeen || hasUnread) && (
                    <div className="indicator-item badge badge-primary badge-xs"></div>
                  )
                )
              }
            })()}
          </div>
        </div>
      </div>
    </NavLink>
  )
}

const ChatList = ({className}: ChatListProps) => {
  const [sessions, setSessions] = useState({} as Record<string, Session>)
  const [publicChats, setPublicChats] = useState<PublicChat[]>([])
  const [userPublicKey, setUserPublicKey] = useState<string>("")

  useEffect(() => {
    localState.get("sessions").put({})
    // TODO irisdb doesnt work right on initial update if we use recursion 3 param
    const unsub = localState.get("sessions").on((sessions) => {
      if (!sessions || typeof sessions !== "object") return
      setSessions({...sessions} as Record<string, Session>)
    })

    // Get user's public key
    const unsubPubKey = localState.get("user/publicKey").on((key) => {
      if (key && typeof key === "string") {
        setUserPublicKey(key)
      }
    })

    return () => {
      unsub()
      unsubPubKey()
    }
  }, [])

  // Fetch public chats where the user has sent messages
  useEffect(() => {
    if (!userPublicKey) return

    const fetchPublicChats = async () => {
      try {
        // Fetch channel messages (kind 42) from the user
        const events = await ndk().fetchEvents({
          kinds: [CHANNEL_MESSAGE],
          authors: [userPublicKey],
        })

        // Extract unique channel IDs
        const channelIds = new Set<string>()
        events.forEach((event) => {
          // In NIP-28, channel messages have an "e" tag with the channel ID
          const channelIdTag = event.tags.find(
            (tag) => tag[0] === "e" && tag[3] === "root"
          )
          if (channelIdTag && channelIdTag[1]) {
            channelIds.add(channelIdTag[1])
          }
        })

        // Fetch channel metadata for each channel
        const chats: PublicChat[] = []
        for (const channelId of channelIds) {
          try {
            // Fetch channel creation event (kind 40)
            const channelEvent = await ndk().fetchEvent({
              kinds: [CHANNEL_CREATE],
              ids: [channelId],
            })

            if (channelEvent) {
              try {
                const metadata = JSON.parse(channelEvent.content)
                chats.push({
                  id: channelId,
                  name: metadata.name || `Channel ${channelId.slice(0, 8)}...`,
                  picture: metadata.picture,
                })
              } catch (e) {
                console.error("Failed to parse channel creation content:", e)
                chats.push({
                  id: channelId,
                  name: `Channel ${channelId.slice(0, 8)}...`,
                })
              }
            } else {
              chats.push({
                id: channelId,
                name: `Channel ${channelId.slice(0, 8)}...`,
              })
            }
          } catch (err) {
            console.error("Error fetching channel metadata:", err)
            chats.push({
              id: channelId,
              name: `Channel ${channelId.slice(0, 8)}...`,
            })
          }
        }

        setPublicChats(chats)
      } catch (err) {
        console.error("Error fetching public chats:", err)
      }
    }

    fetchPublicChats()
  }, [userPublicKey])

  // Combine private and public chats for display
  const allChats = [
    ...Object.entries(sessions)
      .filter(([, session]) => !!session && !session.deleted)
      .map(([id]) => ({id, isPublic: false})),
    ...publicChats.map((chat) => ({id: chat.id, isPublic: true})),
  ]

  // Sort all chats by most recent activity
  const sortedChats = allChats.sort((a, b) => {
    const aLatest = a.isPublic
      ? publicChats.find((chat) => chat.id === a.id)?.latestMessage?.created_at || 0
      : sessions[a.id]?.latest?.time || 0
    const bLatest = b.isPublic
      ? publicChats.find((chat) => chat.id === b.id)?.latestMessage?.created_at || 0
      : sessions[b.id]?.latest?.time || 0

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
