import Header from "@/shared/components/header/Header"
import {useGroupsStore} from "@/stores/groups"
import {useNavigate} from "react-router"

const GroupChatHeader = ({groupId}: {groupId: string}) => {
  const {groups} = useGroupsStore()
  const group = groups[groupId]
  const navigate = useNavigate()
  if (!group) return null

  const handleClick = () => {
    navigate(`/chats/group/${groupId}/details`)
  }

  return (
    <Header showNotifications={false} scrollDown={true} slideUp={false} bold={false}>
      <div className="flex items-center w-full cursor-pointer" onClick={handleClick}>
        {group.picture ? (
          <img src={group.picture} alt="Group" className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center">
            <span className="text-lg">👥</span>
          </div>
        )}
        <div className="flex flex-col ml-2">
          <span className="font-bold text-base">{group.name}</span>
          <span className="text-xs text-base-content/70">{group.description}</span>
        </div>
      </div>
    </Header>
  )
}

export default GroupChatHeader
