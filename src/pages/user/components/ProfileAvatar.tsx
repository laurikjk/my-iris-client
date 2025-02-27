import {NDKUserProfile} from "@nostr-dev-kit/ndk"
import {useNavigate} from "react-router"

interface ProfileAvatarProps {
  profile: NDKUserProfile | null | undefined
  pubkey: string
}

function ProfileAvatar({profile, pubkey}: ProfileAvatarProps) {
  const navigate = useNavigate()

  const handleUserNameClick = () => {
    navigate(`/${pubkey}`)
  }

  // ndk's fetchProfile returns a profile with .image
  // but kind 0 events have profiles with .picture
  let image = profile?.image
  if (!image && typeof profile?.picture === "string") image = profile?.picture

  return (
    <div className="ProfileAvatar cursor-pointer" onClick={handleUserNameClick}>
      {/* Replace MUI Avatar with a custom Avatar component */}
    </div>
  )
}

export default ProfileAvatar
