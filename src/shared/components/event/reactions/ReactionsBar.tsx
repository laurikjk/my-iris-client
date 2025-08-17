import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useEffect, useState, useMemo, ReactNode, useRef} from "react"
import {shouldHideAuthor} from "@/utils/visibility"
import {ndk} from "@/utils/ndk"
import ProxyImg from "@/shared/components/ProxyImg"
import {Name} from "@/shared/components/user/Name"

interface ReactionInfo {
  emoji: string
  pubkeys: Set<string>
  event?: NDKEvent // Store one event to get emoji tags from
  isCustom?: boolean
  emojiUrl?: string
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

      const content = reactionEvent.content || "+"

      // Check if it's a custom emoji
      const customEmojiMatch = content.match(/^:([a-zA-Z0-9_-]+):$/)
      let key = content
      let emojiUrl: string | undefined
      let isCustom = false

      if (customEmojiMatch) {
        const shortcode = customEmojiMatch[1]
        const emojiTag = reactionEvent.tags.find(
          (tag) => tag[0] === "emoji" && tag[1] === shortcode && tag[2]
        )

        if (emojiTag && emojiTag[2]) {
          // Key by URL for custom emojis
          key = emojiTag[2]
          emojiUrl = emojiTag[2]
          isCustom = true
        }
      }

      setReactions((prev) => {
        const newMap = new Map(prev)
        const existing = newMap.get(key) || {
          emoji: content,
          pubkeys: new Set(),
          event: reactionEvent,
          isCustom,
          emojiUrl,
        }
        existing.pubkeys.add(reactionEvent.pubkey)
        // Keep the first reaction event for custom emoji rendering
        if (!existing.event) {
          existing.event = reactionEvent
        }
        newMap.set(key, existing)
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

  // Helper to render emoji content
  const renderEmoji = (reaction: ReactionInfo) => {
    const {emoji, isCustom, emojiUrl} = reaction

    if (emoji === "+") return "❤️"

    // If it's a custom emoji with URL, render the image
    if (isCustom && emojiUrl) {
      return (
        <ProxyImg
          width={20}
          src={emojiUrl}
          alt={emoji}
          className="inline-block h-5 w-5 object-contain"
        />
      )
    }

    // Default emoji rendering
    return emoji
  }

  return (
    <div className="relative">
      <div className="flex gap-2 overflow-x-auto py-2 scrollbar-thin min-h-[38px]">
        {reactions.size === 0 ? (
          // Invisible placeholder with same height as actual elements
          <div className="flex-shrink-0 px-3 py-1.5 opacity-0">
            <span className="text-sm">❤️ 0</span>
          </div>
        ) : (
          sortedReactions.map((reaction, index) => (
            <ReactionItem
              key={reaction.emojiUrl || reaction.emoji || index}
              reaction={reaction}
              renderEmoji={renderEmoji}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface ReactionItemProps {
  reaction: ReactionInfo
  renderEmoji: (reaction: ReactionInfo) => ReactNode
}

function ReactionItem({reaction, renderEmoji}: ReactionItemProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({top: 0, left: 0})
  const buttonRef = useRef<HTMLDivElement>(null)
  const pubkeysArray = useMemo(() => Array.from(reaction.pubkeys), [reaction.pubkeys])

  const handleMouseEnter = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setTooltipPosition({
        top: rect.top - 10,
        left: rect.left + rect.width / 2,
      })
      setShowTooltip(true)
    }
  }

  const handleMouseLeave = () => {
    setShowTooltip(false)
  }

  const maxToShow = 10
  const toShow = pubkeysArray.slice(0, maxToShow)
  const remaining = pubkeysArray.length - maxToShow

  return (
    <>
      <div
        ref={buttonRef}
        className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-base-content/5 border border-base-content/10 text-sm cursor-default"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="text-base align-middle">{renderEmoji(reaction)}</span>
        <span className="font-semibold">{reaction.pubkeys.size}</span>
      </div>
      {showTooltip && (
        <div
          className="fixed px-3 py-2 bg-neutral text-neutral-content rounded-lg shadow-xl text-sm z-[9999] pointer-events-none"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="flex flex-wrap gap-x-1 max-w-xs">
            {toShow.map((pubkey, index) => (
              <span key={pubkey} className="whitespace-nowrap">
                <Name pubKey={pubkey} />
                {index < toShow.length - 1 && ", "}
              </span>
            ))}
            {remaining > 0 && (
              <span className="whitespace-nowrap opacity-75">+{remaining} more</span>
            )}
          </div>
        </div>
      )}
    </>
  )
}
