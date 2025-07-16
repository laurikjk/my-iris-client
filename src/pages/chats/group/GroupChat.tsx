import {useLocation} from "react-router"
import {useState} from "react"

const GroupChat = () => {
  const location = useLocation()
  const groupId = location.state?.id
  const [groupName] = useState("New Group")

  if (!groupId) {
    return (
      <div className="m-4 p-4 md:p-8 rounded-lg bg-base-100">
        <p className="text-center text-base-content/70">No group selected</p>
      </div>
    )
  }

  return (
    <div className="m-4 p-4 md:p-8 rounded-lg bg-base-100">
      <h1 className="text-2xl font-bold mb-4">{groupName}</h1>
      <p className="text-base-content/70">
        Group chat functionality is coming soon! Group ID: {groupId}
      </p>
      <div className="mt-4 p-4 bg-base-200 rounded-lg">
        <p className="text-sm">
          This is a placeholder for the group chat interface. The actual implementation
          would include:
        </p>
        <ul className="list-disc list-inside mt-2 text-sm space-y-1">
          <li>Real-time messaging between group members</li>
          <li>Member management (add/remove members)</li>
          <li>Group settings and permissions</li>
          <li>Message encryption for private groups</li>
          <li>File sharing and media support</li>
        </ul>
      </div>
    </div>
  )
}

export default GroupChat
