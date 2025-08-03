import {Dispatch, SetStateAction, useEffect, useState} from "react"
import {Hexpubkey, NDKEvent, NDKTag} from "@nostr-dev-kit/ndk"

import {muteUser, unmuteUser} from "@/shared/services/Mute.tsx"
import {UserRow} from "@/shared/components/user/UserRow.tsx"
import socialGraph from "@/utils/socialGraph.ts"
import {ndk} from "@/utils/ndk"

interface MuteUserProps {
  setMuting: Dispatch<SetStateAction<boolean>>
  user: Hexpubkey
  event?: NDKEvent
  muteState: boolean
  setMutedState: Dispatch<SetStateAction<boolean>>
}

function MuteUser({user, setMuting, muteState, setMutedState}: MuteUserProps) {
  const [muted, setMuted] = useState<boolean>(false)
  const [publishingError, setPublishingError] = useState<boolean>(false)

  useEffect(() => {
    setMuted(muteState)
  }, [muteState])

  const handleClose = () => {
    setMuting(false)
  }

  const handleMuteUser = async () => {
    try {
      const followDistance = socialGraph().getFollowDistance(user)
      if (followDistance === 1) {
        // Unfollow the user if they are being followed
        const event = new NDKEvent(ndk())
        event.kind = 3
        const followedUsers = socialGraph().getFollowedByUser(socialGraph().getRoot())
        followedUsers.delete(user)
        event.tags = Array.from(followedUsers).map((pubKey) => ["p", pubKey]) as NDKTag[]
        event.publish().catch((e) => console.warn("Error publishing unfollow event:", e))
      }

      const newList = await muteUser(user)
      localStorage.setItem("mutedIds", JSON.stringify(newList))
      setMuted(true)
      setMutedState(true)
      setPublishingError(false)
    } catch (error) {
      console.error("Error muting user:", error)
      setPublishingError(true)
    }
  }

  const handleUnmuteUser = async () => {
    try {
      const newList = await unmuteUser(user)
      localStorage.setItem("mutedIds", JSON.stringify(newList))
      setMuted(false)
      setMutedState(false)
      setPublishingError(false)
    } catch (error) {
      console.error("Error unmuting user:", error)
      setPublishingError(true)
    }
  }

  return (
    <div className="flex flex-col gap-4 w-80 min-w-80">
      <div>
        <h1 className="text-lg font-bold mb-4">Mute User</h1>
        {publishingError && (
          <div className="alert alert-error mb-4">
            <span>Error updating mute list. Please try again.</span>
          </div>
        )}
        <div className="min-h-32">
          {muted ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-center mb-4">User Muted</div>
              <button onClick={handleUnmuteUser} className="btn btn-neutral">
                Undo?
              </button>
            </div>
          ) : (
            <>
              <div>
                <p>Are you sure you want to mute:</p>
                <div className="flex items-center mt-4 mb-4">
                  <UserRow pubKey={user} />
                </div>
              </div>
              <div className="flex justify-center gap-2">
                <button onClick={handleClose} className="btn btn-neutral">
                  No
                </button>
                <button onClick={handleMuteUser} className="btn btn-primary">
                  Yes
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default MuteUser
