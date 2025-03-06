import {ConnectionStatus} from "@/shared/components/connection/ConnectionStatus"
import RelativeTime from "@/shared/components/event/RelativeTime"
import {getMillisecondTimestamp} from "nostr-double-ratchet/src"
import {useLocalState} from "irisdb-hooks/src/useLocalState"
import Header from "@/shared/components/header/Header"
import {Avatar} from "@/shared/components/user/Avatar"
import {Name} from "@/shared/components/user/Name"
import {NavLink, useLocation} from "react-router"
import {useEffect, useState} from "react"
import {localState} from "irisdb/src"
import {MessageType} from "./Message"
import classNames from "classnames"

interface ChatListProps {
  className?: string
}

type Session = {
  messages: string[]
  deleted?: boolean
}

const ChatListItem = ({id}: {id: string}) => {
  const location = useLocation()
  const pubKey = id.split(":").shift() || ""
  const isActive = location.state?.id === id
  useEffect(() => {
    // TODO irisdb should have subscriptions work without this
    localState.get(`sessions/${id}`).get("latest").put({})
  }, [])
  const [latest] = useLocalState(`sessions/${id}/latest`, {} as MessageType)
  const [lastSeen, setLastSeen] = useLocalState(`sessions/${id}/lastSeen`, 0)
  const [deleted] = useLocalState(`sessions/${id}/deleted`, false)
  const previewText =
    latest?.content?.length > 30 ? latest.content.slice(0, 30) + "..." : latest.content
  if (deleted) return null
  return (
    <NavLink
      to="/messages/chat"
      state={{id}}
      key={id}
      onClick={() => setLastSeen(Date.now())}
      className={classNames("px-2 py-4 flex items-center border-b border-custom", {
        "bg-base-300": isActive,
        "hover:bg-base-300": !isActive,
      })}
    >
      <div className="flex flex-row items-center gap-2 flex-1">
        <Avatar pubKey={pubKey} />
        <div className="flex flex-col flex-1">
          <div className="flex flex-row items-center justify-between gap-2">
            <span className="text-base font-semibold">
              <Name pubKey={pubKey} />
            </span>
            <div className="flex flex-col gap-2">
              {latest?.created_at && (
                <span className="text-sm text-base-content/70 ml-2">
                  <RelativeTime from={getMillisecondTimestamp(latest)} />
                </span>
              )}
              <ConnectionStatus peerId={id} />
            </div>
          </div>
          <div className="flex flex-row items-center justify-between gap-2">
            <span className="text-sm text-base-content/70 min-h-[1.25rem]">
              {previewText}
            </span>
            {latest?.created_at &&
              (!lastSeen || getMillisecondTimestamp(latest) > lastSeen) && (
                <div className="indicator-item badge badge-primary badge-xs"></div>
              )}
          </div>
        </div>
      </div>
    </NavLink>
  )
}

const ChatList = ({className}: ChatListProps) => {
  const [sessions, setSessions] = useState({} as Record<string, Session>)
  useEffect(() => {
    localState.get("sessions").put({})
    // TODO irisdb doesnt work right on initial update if we use recursion 3 param
    const unsub = localState.get("sessions").on((sessions) => {
      if (!sessions || typeof sessions !== "object") return
      setSessions({...sessions} as Record<string, Session>)
    })
    return unsub
  }, [])

  return (
    <nav className={className}>
      <div className="md:hidden">
        <Header title="Messages" slideUp={false} />
      </div>
      <div className="flex flex-col">
        <NavLink
          to="/messages/new"
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
        {Object.entries(sessions)
          .filter(([, session]) => !!session && !session.deleted)
          .sort((a: any, b: any) => {
            // If either chat has no latest time, sort it to the bottom
            if (!a[1].latest?.time) return 1
            if (!b[1].latest?.time) return -1
            // Otherwise sort by time descending
            return a[1].latest.time > b[1].latest.time ? -1 : 1
          })
          .map(([id]) => (
            <ChatListItem key={id} id={id} />
          ))}
      </div>
    </nav>
  )
}

export default ChatList
