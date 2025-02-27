import {RiErrorWarningLine, RiVerifiedBadgeLine} from "@remixicon/react"
import {useCallback, useEffect, useState} from "react"
import {NDKUserProfile} from "@nostr-dev-kit/ndk"
import {useNavigate} from "react-router"
import {ndk} from "@/utils/ndk"

interface ProfileNameProps {
  profile: NDKUserProfile | null | undefined
  pubkey: string
}

function ProfileName({profile, pubkey}: ProfileNameProps) {
  const navigate = useNavigate()

  const [nip05valid, setNIP05valid] = useState<boolean>(false)

  const handleClick = useCallback(() => navigate(`/${pubkey}`), [pubkey])

  const validateNip05 = () => {
    if (profile?.nip05) {
      ndk()
        .getUser({hexpubkey: pubkey})
        ?.validateNip05(profile?.nip05)
        .then((isValid) => setNIP05valid(isValid ? isValid : false))
        .catch((error) => console.warn(error))
    }
  }

  useEffect(() => {
    validateNip05()
  }, [])

  return (
    <div className="ProfileItem-text-container cursor-pointer" onClick={handleClick}>
      <span className="ProfileName-names-row">
        {profile?.name && <span>{profile.name}</span>}
        {profile?.name && profile?.displayName && (
          <span className="greytext">{profile?.displayName}</span>
        )}
        {!profile?.name && profile?.displayName && <span>{profile?.displayName}</span>}
      </span>
      {!profile?.name && !profile?.displayName && <span>Anonymous Nostrich</span>}
      {profile?.nip05 && (
        <span className="ProfileName-nip05">
          {nip05valid ? (
            <RiVerifiedBadgeLine className="ProfileName-nip05-icon" />
          ) : (
            <RiErrorWarningLine className="ProfileName-nip05-icon" />
          )}
          <small className="ProfileName-nip05-text">{profile?.nip05}</small>
        </span>
      )}
    </div>
  )
}

export default ProfileName
