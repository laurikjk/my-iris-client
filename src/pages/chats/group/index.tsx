import GroupChatCreation from "./GroupChatCreation"
import GroupChatPage from "./GroupChatPage"
import GroupDetailsPage from "./GroupDetailsPage"
import {useLocation} from "@/navigation"

const GroupGroupRoutes = () => {
  const location = useLocation()
  const pathSegments = location.pathname.split("/").filter(Boolean)

  // pathSegments: ['chats', 'group', 'new'] or ['chats', 'group', 'id'] or ['chats', 'group', 'id', 'details']
  if (pathSegments[2] === "new") {
    return <GroupChatCreation />
  } else if (pathSegments[3] === "details") {
    return <GroupDetailsPage />
  } else if (pathSegments[2]) {
    return <GroupChatPage />
  }

  return null
}

export default GroupGroupRoutes
