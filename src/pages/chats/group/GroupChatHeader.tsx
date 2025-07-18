import Header from "@/shared/components/header/Header"
import {useGroupsStore} from "@/stores/groups"
import {useNavigate} from "react-router"
import {useState} from "react"
import {RiMoreLine} from "@remixicon/react"
import Dropdown from "@/shared/components/ui/Dropdown"

const GroupChatHeader = ({groupId}: {groupId: string}) => {
  const {groups, removeGroup} = useGroupsStore()
  const group = groups[groupId]
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  if (!group) return null

  const handleClick = () => {
    navigate(`/chats/group/${groupId}/details`)
  }

  const handleDeleteGroup = () => {
    if (groupId && confirm("Delete this group?")) {
      removeGroup(groupId)
      navigate("/chats")
    }
  }

  return (
    <Header showNotifications={false} scrollDown={true} slideUp={false} bold={false}>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center cursor-pointer flex-1" onClick={handleClick}>
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
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="btn btn-ghost btn-sm btn-circle"
          >
            <RiMoreLine className="h-6 w-6 cursor-pointer text-base-content/50" />
          </button>
          {dropdownOpen && (
            <Dropdown onClose={() => setDropdownOpen(false)}>
              <ul className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                <li>
                  <button onClick={handleDeleteGroup}>Delete Group</button>
                </li>
              </ul>
            </Dropdown>
          )}
        </div>
      </div>
    </Header>
  )
}

export default GroupChatHeader
