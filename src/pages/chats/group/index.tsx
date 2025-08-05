import GroupChatCreation from "./GroupChatCreation"
import GroupChatPage from "./GroupChatPage"
import GroupDetailsPage from "./GroupDetailsPage"
import {Routes, Route} from "@/navigation"

const GroupGroupRoutes = () => (
  <Routes>
    <Route path="new" element={<GroupChatCreation />} />
    <Route path=":id" element={<GroupChatPage />} />
    <Route path=":id/details" element={<GroupDetailsPage />} />
  </Routes>
)

export default GroupGroupRoutes
