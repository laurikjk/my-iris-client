import {UserRow} from "@/shared/components/user/UserRow.tsx"
import {RiFlashlightLine} from "@remixicon/react"
import {NDKEvent} from "@nostr-dev-kit/ndk"

interface RezapHeaderProps {
  event: NDKEvent
}

function RezapHeader({event}: RezapHeaderProps) {
  return (
    <span className="flex items-center font-bold">
      <UserRow pubKey={event.pubkey} avatarWidth={38} />
      <span className="mr-1 -ml-1">rezapped</span>
      <RiFlashlightLine className="text-custom-accent" />
    </span>
  )
}

export default RezapHeader
