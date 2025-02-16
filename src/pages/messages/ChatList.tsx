import RelativeTime from "@/shared/components/event/RelativeTime"
import {Avatar} from "@/shared/components/user/Avatar"
import {Name} from "@/shared/components/user/Name"
import {useLocalState} from "irisdb-hooks"
import {useEffect, useState} from "react"
import {NavLink} from "react-router-dom"
import classNames from "classnames"
import {localState} from "irisdb"

interface ChatListProps {
  className?: string
}

type Channel = {
  messages: string[]
  deleted?: boolean
}

const ChatListItem = ({id}: {id: string}) => {
  const pubKey = id.split(":").shift() || ""
  useEffect(() => {
    // TODO irisdb should have subscriptions work without this
    localState.get(`channels/${id}`).get("latest").put({})
  }, [])
  const [latest] = useLocalState(
    `channels/${id}/latest`,
    {} as {content: string; time: number}
  )
  const [lastSeen, setLastSeen] = useLocalState(`channels/${id}/lastSeen`, 0)
  return (
    <NavLink
      to={`/messages/${id}`}
      key={id}
      onClick={() => setLastSeen(Date.now())}
      className={({isActive}) =>
        classNames("px-2 py-4 flex items-center border-b border-custom", {
          "bg-base-300": isActive,
          "hover:bg-base-300": !isActive,
        })
      }
    >
      <div className="flex flex-row items-center gap-2 flex-1">
        <Avatar pubKey={pubKey} />
        <div className="flex flex-col flex-1">
          <div className="flex flex-row items-center justify-between gap-2">
            <span className="text-base font-semibold">
              <Name pubKey={pubKey} />
            </span>
            {latest?.time && (
              <span className="text-sm text-base-content/70 ml-2">
                <RelativeTime from={latest.time} />
              </span>
            )}
          </div>
          <div className="flex flex-row items-center justify-between gap-2">
            <span className="text-sm text-base-content/70 min-h-[1.25rem]">
              {latest?.content?.slice(0, 20)}
            </span>
            {latest?.time && (!lastSeen || latest.time > lastSeen) && (
              <div className="indicator-item badge badge-primary badge-xs"></div>
            )}
          </div>
        </div>
      </div>
    </NavLink>
  )
}

const ChatList = ({className}: ChatListProps) => {
  const [channels, setChannels] = useState({} as Record<string, Channel>)
  useEffect(() => {
    localState.get("channels").put({})
    // TODO irisdb doesnt work right on initial update if we use recursion 3 param
    const unsub = localState.get("channels").on((channels) => {
      if (!channels || typeof channels !== "object") return
      setChannels({...channels} as Record<string, Channel>)
    })
    return unsub
  }, [])

  return (
    <nav className={className}>
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
        {Object.entries(channels)
          .filter(([, channel]) => !!channel && !channel.deleted)
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
