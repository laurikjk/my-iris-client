import {UserRow} from "@/shared/components/user/UserRow.tsx"
import {ReactionContent} from "./ReactionContent"
import socialGraph from "@/utils/socialGraph"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useReactionsByAuthor} from "@/shared/hooks/useReactions"

export default function Likes({event}: {event: NDKEvent}) {
  const reactions = useReactionsByAuthor(event.id)

  return (
    <div className="flex flex-col gap-4">
      {reactions.size === 0 && <p>No reactions yet</p>}
      {Array.from(reactions.values())
        .sort((a, b) => {
          return (
            socialGraph().getFollowDistance(a.author.pubkey) -
            socialGraph().getFollowDistance(b.author.pubkey)
          )
        })
        .map((reactionEvent) => (
          <UserRow
            showHoverCard={true}
            key={reactionEvent.id}
            pubKey={reactionEvent.author.pubkey}
            description={
              <ReactionContent content={reactionEvent.content} event={reactionEvent} />
            }
          />
        ))}
    </div>
  )
}
