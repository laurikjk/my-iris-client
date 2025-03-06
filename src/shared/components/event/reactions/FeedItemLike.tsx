import {useEffect, useState, lazy, Suspense, useRef} from "react"
import {isTouchDevice} from "@/shared/utils/isTouchDevice"
import {shouldHideEvent} from "@/utils/socialGraph"
import {LRUCache} from "typescript-lru-cache"
import {formatAmount} from "@/utils/utils.ts"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import debounce from "lodash/debounce"
import {localState} from "irisdb/src"
import Icon from "../../Icons/Icon"
import {ndk} from "@/utils/ndk"

const likeCache = new LRUCache<string, Set<string>>({
  maxSize: 100,
})

let myPubKey = ""
localState.get("user/publicKey").on((k) => (myPubKey = k as string))

const EmojiPicker = lazy(() => import("@emoji-mart/react"))

export const FeedItemLike = ({event}: {event: NDKEvent}) => {
  const cachedLikes = likeCache.get(event.id)

  const [likesByAuthor, setLikesByAuthor] = useState<Set<string>>(
    cachedLikes || new Set()
  )
  const [likeCount, setLikeCount] = useState(likesByAuthor.size)
  const [myReaction, setMyReaction] = useState<string>("+")
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [emojiData, setEmojiData] = useState<any>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const longPressTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [isLongPress, setIsLongPress] = useState(false)

  const like = async () => {
    if (likesByAuthor.has(myPubKey)) return
    try {
      event.react("+")
      setMyReaction("+")
      setLikesByAuthor((prev) => {
        const newSet = new Set(prev)
        newSet.add(myPubKey)
        likeCache.set(event.id, newSet)
        setLikeCount(newSet.size)
        return newSet
      })
    } catch (error) {
      console.warn(`Could not publish reaction: ${error}`)
    }
  }

  const handleEmojiSelect = async (emoji: any) => {
    if (!myPubKey) return
    try {
      await event.react(emoji.native)
      setMyReaction(emoji.native)
      setShowEmojiPicker(false)
      setLikesByAuthor((prev) => {
        const newSet = new Set(prev)
        newSet.add(myPubKey)
        likeCache.set(event.id, newSet)
        setLikeCount(newSet.size)
        return newSet
      })
    } catch (error) {
      console.warn(`Could not publish reaction: ${error}`)
    }
  }

  useEffect(() => {
    if (showEmojiPicker && !emojiData) {
      import("@emoji-mart/data")
        .then((module) => module.default)
        .then((data) => setEmojiData(data))
    }
  }, [showEmojiPicker, emojiData])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        event.stopPropagation()
        event.preventDefault()
        setShowEmojiPicker(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleMouseDown = () => {
    setIsLongPress(false)
    longPressTimeout.current = setTimeout(() => {
      setIsLongPress(true)
      setShowEmojiPicker(true)
    }, 500)
  }

  const handleMouseUp = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current)
    }
  }

  const handleClick = () => {
    if (!isLongPress) {
      like()
    }
  }

  useEffect(() => {
    const filter = {
      kinds: [7],
      ["#e"]: [event.id],
    }

    try {
      const sub = ndk().subscribe(filter)
      const debouncedUpdate = debounce((likesByAuthor) => {
        setLikeCount(likesByAuthor.size)
      }, 300)

      sub?.on("event", (likeEvent: NDKEvent) => {
        if (shouldHideEvent(likeEvent)) return
        if (likeEvent.pubkey === myPubKey) {
          setMyReaction(likeEvent.content)
        }
        setLikesByAuthor((prev) => {
          const newSet = new Set(prev)
          newSet.add(likeEvent.pubkey)
          likeCache.set(event.id, newSet)
          debouncedUpdate(newSet)
          return newSet
        })
      })

      return () => {
        sub.stop()
        debouncedUpdate.cancel()
      }
    } catch (error) {
      console.warn(error)
    }
  }, [])

  const liked = likesByAuthor.has(myPubKey)

  const getReactionIcon = () => {
    if (!liked) return <Icon name="heart" size={16} />
    if (myReaction === "+") return <Icon name="heart-solid" size={16} />
    return <span className="text-base leading-none">{myReaction}</span>
  }

  return (
    <div
      title="Like"
      className={`relative min-w-[50px] md:min-w-[80px] transition-colors duration-200 ease-in-out cursor-pointer likeIcon ${
        liked ? "text-error" : "hover:text-error"
      } flex flex-row gap-1 items-center`}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
    >
      {getReactionIcon()}
      <span>{formatAmount(likeCount)}</span>

      {showEmojiPicker && emojiData && (
        <div
          ref={emojiPickerRef}
          className={`z-10 mb-2 fixed md:absolute md:top-0 left-4 md:left-0 md:-translate-y-full bottom-20 md:bottom-auto`}
          onClick={(e) => e.stopPropagation()}
        >
          <Suspense
            fallback={<div className="p-4 bg-base-100 rounded shadow">Loading...</div>}
          >
            <EmojiPicker
              data={emojiData}
              onEmojiSelect={handleEmojiSelect}
              autoFocus={!isTouchDevice}
              searchPosition="sticky"
              previewPosition="none"
              skinTonePosition="none"
              theme="auto"
              maxFrequentRows={1}
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}
