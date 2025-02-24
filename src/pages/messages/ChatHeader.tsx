import MiddleHeader from "@/shared/components/header/MiddleHeader"
import {RiMoreLine, RiAttachment2} from "@remixicon/react"
import {UserRow} from "@/shared/components/user/UserRow"
import Dropdown from "@/shared/components/ui/Dropdown"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {Session} from "nostr-double-ratchet"
import {useNavigate} from "react-router-dom"
import {useEffect, useState} from "react"
import {getSession} from "./Sessions"
import {MessageType} from "./Message"
import {localState} from "irisdb"

interface ChatHeaderProps {
  id: string
  messages: SortedMap<string, MessageType>
}

const ChatHeader = ({id, messages}: ChatHeaderProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [session, setSession] = useState<Session | undefined>(undefined)
  const navigate = useNavigate()

  const handleDeleteChat = () => {
    if (id && confirm("Delete this chat?")) {
      // TODO: delete properly, maybe needs irisdb support.
      // also somehow make sure chatlinks dont respawn it
      localState.get("sessions").get(id).get("state").put(null)
      localState.get("sessions").get(id).get("deleted").put(true)
      // put null to each message. at least the content is removed
      for (const [messageId] of messages) {
        localState.get("sessions").get(id).get("events").get(messageId).put(null)
      }
      navigate("/messages")
    }
  }

  const handleSendFile = () => {
    // TODO: Implement file sending functionality
    console.log("Send file clicked")
    if (session) {
      import("./webrtc/PeerConnection")
        .then((module) => {
          const PeerConnection = module.default
          const peerConnection = new PeerConnection(session)
          peerConnection.connect()
          console.log("peerConnection", peerConnection)
        })
        .catch((error) => {
          console.error("Error loading PeerConnection module:", error)
        })
    }
  }

  useEffect(() => {
    const fetchSession = async () => {
      if (id) {
        const fetchedSession = await getSession(id)
        setSession(fetchedSession)
      }
    }

    fetchSession()
  }, [id])

  const user = id.split(":").shift()!

  return (
    <MiddleHeader centered={false}>
      <div className="flex items-center justify-between w-full">
        <div>{id && <UserRow avatarWidth={32} pubKey={user} />}</div>
        <div className="flex items-center gap-2 relative">
          <button
            onClick={handleSendFile}
            className="btn btn-ghost btn-sm btn-circle"
            title="Send file"
          >
            <RiAttachment2 className="h-5 w-5 cursor-pointer text-base-content/50" />
          </button>
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
                  <button onClick={handleDeleteChat}>Delete Chat</button>
                </li>
              </ul>
            </Dropdown>
          )}
        </div>
      </div>
    </MiddleHeader>
  )
}

export default ChatHeader
