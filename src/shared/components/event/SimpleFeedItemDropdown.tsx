import {RiMoreLine} from "@remixicon/react"
import {useState} from "react"
import {DoubleRatchetUserSearch} from "@/pages/chats/components/DoubleRatchetUserSearch"
import {DoubleRatchetUser} from "@/pages/chats/utils/doubleRatchetUsers"
import {useSessionsStore} from "@/stores/sessions"
import Modal from "@/shared/components/ui/Modal"

type FeedItemDropdownProps = {
  eventId: string
}

function SimpleFeedItemDropdown({eventId}: FeedItemDropdownProps) {
  const {sendToUser} = useSessionsStore()
  const [showSendDM, setShowSendDM] = useState(false)

  const handleCopyNoteID = () => {
    navigator.clipboard.writeText(eventId)
  }
  const handleCopyLink = () => {
    const shareUrl = `https://iris.to/${eventId}`
    navigator.clipboard.writeText(shareUrl)
  }
  const handleSendDM = () => {
    setShowSendDM(true)
  }

  const handleUserSelect = async (user: DoubleRatchetUser) => {
    try {
      const shareUrl = `https://iris.to/${eventId}`
      const message = `Check out this post: ${shareUrl}`
      
      await sendToUser(user.pubkey, {
        content: message,
        kind: 4,
        tags: [["ms", Date.now().toString()]],
      })
      
      setShowSendDM(false)
    } catch (error) {
      console.error("Failed to send DM:", error)
    }
  }

  return (
    <div className="" onClick={(e) => e.stopPropagation()}>
      {showSendDM && (
        <div onClick={(e) => e.stopPropagation()}>
          <Modal onClose={() => setShowSendDM(false)}>
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">Send as DM</h3>
              <DoubleRatchetUserSearch
                placeholder="Search for a user to send this post to"
                onUserSelect={handleUserSelect}
                maxResults={10}
                showCount={true}
              />
            </div>
          </Modal>
        </div>
      )}
      <div className="dropdown">
        <div tabIndex={0} role="button" className="p-2 text-base-content/50">
          <RiMoreLine className="h-6 w-6 cursor-pointer" />
        </div>
        <ul
          tabIndex={0}
          className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52"
        >
          <li>
            <button onClick={handleCopyNoteID}>Copy Event ID</button>
          </li>
          <li>
            <button onClick={handleCopyLink}>Copy Link</button>
          </li>
          <li>
            <button onClick={handleSendDM}>Send as DM</button>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default SimpleFeedItemDropdown
