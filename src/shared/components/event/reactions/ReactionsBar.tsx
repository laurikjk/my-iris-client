import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useEffect, useState} from "react"
import {shouldHideAuthor} from "@/utils/visibility"
import {ndk} from "@/utils/ndk"

interface ReactionInfo {
  emoji: string
  pubkeys: Set<string>
}

interface ReactionsBarProps {
  event: NDKEvent
}

export default function ReactionsBar({event}: ReactionsBarProps) {
  const [reactions, setReactions] = useState<Map<string, ReactionInfo>>(new Map())

  useEffect(() => {
    const filter = {
      kinds: [7],
      ["#e"]: [event.id],
    }

    const sub = ndk().subscribe(filter)

    sub?.on("event", (reactionEvent: NDKEvent) => {
      if (shouldHideAuthor(reactionEvent.author.pubkey)) return

      const emoji = reactionEvent.content || "+"

      setReactions((prev) => {
        const newMap = new Map(prev)
        const existing = newMap.get(emoji) || {emoji, pubkeys: new Set()}
        existing.pubkeys.add(reactionEvent.pubkey)
        newMap.set(emoji, existing)
        return newMap
      })
    })

    return () => {
      sub.stop()
    }
  }, [event.id])

  // Sort reactions by count
  const sortedReactions = Array.from(reactions.values()).sort(
    (a, b) => b.pubkeys.size - a.pubkeys.size
  )

  return (
    <div className="flex gap-2 overflow-x-auto py-2 scrollbar-thin min-h-[38px]">
      {reactions.size === 0 ? (
        // Invisible placeholder with same height as actual elements
        <div className="flex-shrink-0 px-3 py-1.5 opacity-0">
          <span className="text-sm">❤️ 0</span>
        </div>
      ) : (
        sortedReactions.map((reaction) => (
          <div
            key={reaction.emoji}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-base-content/5 border border-base-content/10 text-sm"
          >
            <span className="text-base">
              {reaction.emoji === "+" ? "❤️" : reaction.emoji}
            </span>
            <span className="font-semibold">{reaction.pubkeys.size}</span>
          </div>
        ))
      )}
    </div>
  )
}
