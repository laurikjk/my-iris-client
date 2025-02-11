import {Name} from "@/shared/components/user/Name"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {Link} from "react-router-dom"
import {nip19} from "nostr-tools"

interface LikeHeaderProps {
  event: NDKEvent
}

function LikeHeader({event}: LikeHeaderProps) {
  const reactionText =
    event.content === "+" ? "liked" : `reacted with ${event.content.slice(0, 2)}`

  return (
    <Link
      to={`/${nip19.npubEncode(event.pubkey)}`}
      className="flex items-center font-bold text-sm text-base-content/50 hover:underline"
    >
      <Name pubKey={event.pubkey} />
      <span className="mx-1">{reactionText}</span>
    </Link>
  )
}

export default LikeHeader
