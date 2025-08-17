import {
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
  useMemo,
  useState,
} from "react"
import {FloatingEmojiPicker} from "@/shared/components/emoji/FloatingEmojiPicker"
import {formatAmount} from "@/utils/utils.ts"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useUserStore} from "@/stores/user"
import {useScrollAwareLongPress} from "@/shared/hooks/useScrollAwareLongPress"
import EmojiType from "@/types/emoji"
import Icon from "../../Icons/Icon"
import {useReactionsByAuthor} from "@/shared/hooks/useReactions"

export const FeedItemLike = ({
  event,
  showReactionCounts = true,
}: {
  event: NDKEvent
  showReactionCounts?: boolean
}) => {
  const myPubKey = useUserStore((state) => state.publicKey)
  const reactionsByAuthor = useReactionsByAuthor(event.id)

  const likesByAuthor = useMemo(() => {
    if (!showReactionCounts) return new Set<string>()
    const likesSet = new Set<string>()
    for (const [pubkey] of reactionsByAuthor) {
      likesSet.add(pubkey)
    }
    return likesSet
  }, [reactionsByAuthor, showReactionCounts])

  const myReactionEvent = reactionsByAuthor.get(myPubKey || "")
  const myReaction = myReactionEvent?.content || "+"

  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [pickerPosition, setPickerPosition] = useState<{clientY?: number}>({})
  const {
    handleMouseDown: handleLongPressDown,
    handleMouseMove: handleLongPressMove,
    handleMouseUp: handleLongPressUp,
    isLongPress,
  } = useScrollAwareLongPress({
    onLongPress: () => setShowEmojiPicker(true),
  })

  // Custom handler to also set picker position
  const handleMouseDown = (
    e: ReactMouseEvent<HTMLButtonElement> | ReactTouchEvent<HTMLButtonElement>
  ) => {
    if (!myPubKey) return

    // Set picker position
    if ("touches" in e && e.touches.length > 0) {
      setPickerPosition({clientY: e.touches[0].clientY})
    } else if ("clientY" in e) {
      setPickerPosition({clientY: e.clientY})
    }

    // Delegate to long press handler
    handleLongPressDown(e)
  }

  const like = async () => {
    if (!myPubKey || likesByAuthor.has(myPubKey)) return
    try {
      await event.react("+")
    } catch (error) {
      console.warn(`Could not publish reaction: ${error}`)
    }
  }

  const handleEmojiSelect = async (emoji: EmojiType) => {
    if (!myPubKey) return
    try {
      await event.react(emoji.native)
      setShowEmojiPicker(false)
    } catch (error) {
      console.warn(`Could not publish reaction: ${error}`)
    }
  }

  const handleClick = () => {
    if (!isLongPress) {
      like()
    }
  }

  const liked = likesByAuthor.has(myPubKey)

  const getReactionIcon = () => {
    if (!liked) return <Icon name="heart" size={16} />
    if (myReaction === "+") return <Icon name="heart-solid" size={16} />
    return <span className="text-base leading-none">{myReaction}</span>
  }

  return (
    <button
      title="Like"
      data-testid="like-button"
      className={`relative min-w-[50px] md:min-w-[80px] transition-colors duration-200 ease-in-out cursor-pointer likeIcon ${
        liked ? "text-error" : "hover:text-error"
      } flex flex-row gap-1 items-center`}
      onClick={handleClick}
      onMouseDown={(e) => handleMouseDown(e)}
      onMouseMove={(e) => handleLongPressMove(e)}
      onMouseUp={handleLongPressUp}
      onMouseLeave={handleLongPressUp}
      onTouchStart={(e) => handleMouseDown(e)}
      onTouchMove={(e) => handleLongPressMove(e)}
      onTouchEnd={handleLongPressUp}
    >
      {getReactionIcon()}
      <span data-testid="like-count">
        {showReactionCounts ? formatAmount(likesByAuthor.size) : ""}
      </span>

      <FloatingEmojiPicker
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={handleEmojiSelect}
        position={pickerPosition}
      />
    </button>
  )
}
