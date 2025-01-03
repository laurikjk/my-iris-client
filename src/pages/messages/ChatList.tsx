import {UserRow} from "@/shared/components/user/UserRow"
import {useLocalState} from "irisdb-hooks"
import {NavLink} from "react-router-dom"
import classNames from "classnames"

interface ChatListProps {
  className?: string
}

type Channel = {
  messages: string[]
}

const ChatListItem = ({id}: {id: string}) => {
  const pubKey = id.split(":").shift() || ""
  const [latest] = useLocalState(`channels/${id}/latest`, {} as {content?: string})
  return (
    <NavLink
      to={`/messages/${id}`}
      key={id}
      className={({isActive}) =>
        classNames("p-2 flex items-center border-b border-custom", {
          "bg-base-300": isActive,
          "hover:bg-base-300": !isActive,
        })
      }
    >
      <div className="flex flex-col">
        <span className="text-base font-semibold">
          <UserRow pubKey={pubKey} linkToProfile={false} />
        </span>
        <span>{latest.content?.slice(0, 20)}</span>
      </div>
    </NavLink>
  )
}

const ChatList = ({className}: ChatListProps) => {
  const [channels] = useLocalState("channels", {} as Record<string, Channel>)
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
        {Object.keys(channels).map((id) => (
          <ChatListItem key={id} id={id} />
        ))}
      </div>
    </nav>
  )
}

export default ChatList
