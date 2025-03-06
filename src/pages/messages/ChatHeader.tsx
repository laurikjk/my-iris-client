import {ConnectionStatus} from "@/shared/components/connection/ConnectionStatus"
import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {RiMoreLine, RiAttachment2} from "@remixicon/react"
import {getPeerConnection} from "./webrtc/PeerConnection"
import {UserRow} from "@/shared/components/user/UserRow"
import Header from "@/shared/components/header/Header"
import Dropdown from "@/shared/components/ui/Dropdown"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {Session} from "nostr-double-ratchet/src"
import socialGraph from "@/utils/socialGraph"
import {useEffect, useState} from "react"
import {useNavigate} from "react-router"
import {getSession} from "./Sessions"
import {localState} from "irisdb/src"
import {MessageType} from "./Message"

interface ChatHeaderProps {
  id: string
  messages: SortedMap<string, MessageType>
}

const ChatHeader = ({id, messages}: ChatHeaderProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [session, setSession] = useState<Session | undefined>(undefined)
  const [myPubKey] = useLocalState("user/publicKey", "")
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
    if (session) {
      const peerConnection = getPeerConnection(id, {
        ask: false,
        create: true,
        connect: true,
      })
      if (peerConnection) {
        // Create a hidden file input
        const fileInput = document.createElement("input")
        fileInput.type = "file"
        fileInput.style.display = "none"
        fileInput.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) {
            peerConnection.sendFile(file)
          }
        }
        document.body.appendChild(fileInput)
        fileInput.click()
        document.body.removeChild(fileInput)
      }
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

  const showWebRtc =
    socialGraph().getFollowedByUser(user).has(myPubKey) || user === myPubKey

  return (
    <Header showNotifications={false} scrollDown={true} slideUp={false} bold={false}>
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-row items-center gap-2">
          {id && <UserRow avatarWidth={32} pubKey={user} />}
          <ConnectionStatus peerId={id} showDisconnect={true} />
        </div>
        <div className="flex items-center gap-2 relative">
          {showWebRtc && (
            <button
              onClick={handleSendFile}
              className="btn btn-ghost btn-sm btn-circle"
              title="Send file"
            >
              <RiAttachment2 className="h-5 w-5 cursor-pointer text-base-content/50" />
            </button>
          )}
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
    </Header>
  )
}

export default ChatHeader
