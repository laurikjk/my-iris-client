import {CustomEmojiComponent} from "../embed/nostr/CustomEmojiComponent"
import CustomEmoji from "../embed/nostr/CustomEmoji"
import {Name} from "@/shared/components/user/Name"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {Link} from "react-router"
import {nip19} from "nostr-tools"

interface LikeHeaderProps {
  event: NDKEvent
}

function LikeHeader({event}: LikeHeaderProps) {
  const reactionText =
    event.content === "+" ? (
      <span className="text-base-content/50">liked</span>
    ) : (
      <>
        <span className="text-base-content/50">reacted with </span>
        {event.content.match(CustomEmoji.regex) ? (
          <CustomEmojiComponent
            match={event.content.match(CustomEmoji.regex)?.[1] || event.content}
            event={event}
          />
        ) : (
          <span>{event.content}</span>
        )}
      </>
    )

  return (
    <Link
      to={`/${nip19.npubEncode(event.pubkey)}`}
      className="flex items-center font-bold text-sm hover:underline"
    >
      <Name pubKey={event.pubkey} className="text-base-content/50" />
      <span className="mx-1">{reactionText}</span>
    </Link>
  )
}

export default LikeHeader
