import {Dispatch, SetStateAction, useEffect, useState} from "react"
import {NDKUserProfile} from "@nostr-dev-kit/ndk"
import {RiUserLine} from "@remixicon/react"
import {useNavigate} from "react-router"
import {ndk} from "@/utils/ndk"

import ProfileAvatar from "./ProfileAvatar.tsx"
import ProfileName from "./ProfileName.tsx"

interface ProfileItemProps {
  pubkey: string
  setShowFollowList: Dispatch<SetStateAction<boolean>>
}

function ProfileItem({pubkey, setShowFollowList}: ProfileItemProps) {
  const navigate = useNavigate()

  const [profile, setProfile] = useState<NDKUserProfile | null>(null)

  const handleUserNameClick = () => {
    if (pubkey) {
      navigate(`/${pubkey}`)
      setShowFollowList(false)
    }
  }

  const fetchProfile = () => {
    ndk()
      .getUser({pubkey: pubkey})
      .fetchProfile()
      .then((profile) => setProfile(profile))
      .catch((error) => console.warn(error))
  }

  useEffect(() => {
    fetchProfile()
  })

  // loading animation
  if (!profile) {
    return (
      <div className="ProfileItem loading-item">
        <div className="ProfileItem-avatar-container">
          <RiUserLine className="h-10 w-10" />
        </div>
        <div className="ProfileItem-text-container">Fetching profile...</div>
      </div>
    )
  }

  return (
    <div className="ProfileItem cursor-pointer" onClick={handleUserNameClick}>
      <div className="ProfileItem-avatar-container">
        <ProfileAvatar profile={profile} pubkey={pubkey} />
      </div>
      <ProfileName profile={profile} pubkey={pubkey} />
    </div>
  )
}

export default ProfileItem
