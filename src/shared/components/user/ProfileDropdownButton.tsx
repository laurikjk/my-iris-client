import {useState} from "react"
import {RiMoreLine} from "@remixicon/react"
import ProfileDropdown from "./ProfileDropdown"

type ProfileDropdownButtonProps = {
  pubKey: string
}

function ProfileDropdownButton({pubKey}: ProfileDropdownButtonProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  return (
    <div className="relative">
      <button
        className="btn btn-circle btn-ghost"
        onClick={(e) => {
          e.stopPropagation()
          setShowDropdown((v) => !v)
        }}
        aria-label="More options"
      >
        <RiMoreLine className="h-6 w-6 cursor-pointer text-base-content/50" />
      </button>
      {showDropdown && (
        <div className="absolute right-0 z-50">
          <ProfileDropdown pubKey={pubKey} onClose={() => setShowDropdown(false)} />
        </div>
      )}
    </div>
  )
}

export default ProfileDropdownButton 