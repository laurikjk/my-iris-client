import {useState} from "react"

import {unmuteUser} from "@/shared/services/Mute.tsx"
import {useUserStore} from "@/stores/user"
import socialGraph from "@/utils/socialGraph.ts"
import Dropdown from "@/shared/components/ui/Dropdown.tsx"
import Modal from "@/shared/components/ui/Modal.tsx"
import MuteUser from "@/shared/components/event/MuteUser.tsx"
import Icon from "@/shared/components/Icons/Icon"

type ProfileDropdownProps = {
  pubKey: string
  onClose: () => void
}

function ProfileDropdown({pubKey, onClose}: ProfileDropdownProps) {
  const myPubKey = useUserStore((state) => state.publicKey)
  const [muting, setMuting] = useState(false)
  const [, setUpdated] = useState(0)

  const isLoggedIn = !!myPubKey
  const isMuted = isLoggedIn && socialGraph().getMutedByUser(myPubKey).has(pubKey)

  const handleMute = async () => {
    if (isMuted) {
      try {
        await unmuteUser(pubKey)
        // Force a re-render to update the button state
        setUpdated((updated) => updated + 1)
        onClose()
      } catch (error) {
        console.error("Error unmuting user:", error)
      }
    } else {
      setMuting(true)
    }
  }

  return (
    <div className="z-40">
      <Dropdown onClose={onClose}>
        {muting && (
          <div onClick={(e) => e.stopPropagation()}>
            <Modal onClose={() => setMuting(false)}>
              <MuteUser
                muteState={isMuted}
                user={pubKey}
                setMuting={setMuting}
                setMutedState={() => {
                  setUpdated((updated) => updated + 1)
                }}
              />
            </Modal>
          </div>
        )}
        <ul
          tabIndex={0}
          className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52"
        >
          {isLoggedIn && (
            <li>
              <button onClick={handleMute}>
                <Icon name={isMuted ? "volume-up" : "volume-off"} className="w-4 h-4" />
                {isMuted ? "Unmute" : "Mute"}
              </button>
            </li>
          )}
        </ul>
      </Dropdown>
    </div>
  )
}

export default ProfileDropdown
