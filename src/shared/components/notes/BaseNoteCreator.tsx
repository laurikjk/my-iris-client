import {useState, useEffect, useRef, KeyboardEvent} from "react"
import {Link, useNavigate} from "@/navigation"
import {nip19} from "nostr-tools"
import {NDKEvent, NDKKind} from "@nostr-dev-kit/ndk"
import {useDraftStore} from "@/stores/draft"
import EmojiButton from "@/shared/components/emoji/EmojiButton"
import {Avatar} from "@/shared/components/user/Avatar"
import {usePublicKey} from "@/stores/user"
import {ndk} from "@/utils/ndk"
import UploadButton from "@/shared/components/button/UploadButton"
import {useGeohashLocation} from "@/shared/hooks/useGeohashLocation"
import {RiAttachment2} from "@remixicon/react"

interface BaseNoteCreatorProps {
  onClose?: () => void
  replyingTo?: NDKEvent
  placeholder?: string
  autofocus?: boolean
  className?: string
  showPreview?: boolean
  variant?: "inline" | "modal"
  onPublish?: () => void
  expandOnFocus?: boolean
}

export function BaseNoteCreator({
  onClose,
  replyingTo,
  placeholder = "What's happening?",
  autofocus = false,
  className = "",
  showPreview = false,
  variant = "inline",
  onPublish: onPublishCallback,
  expandOnFocus = false,
}: BaseNoteCreatorProps) {
  const myPubKey = usePublicKey()
  const ndkInstance = ndk()
  const draftStore = useDraftStore()
  const navigate = useNavigate()

  const [text, setText] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [imageMetadata, setImageMetadata] = useState<
    Record<string, {width: number; height: number; blurhash: string}>
  >({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const {geohashes, resetGeohashes, GeohashDisplay, LocationButton} = useGeohashLocation()

  // Initialize from draft store for new posts
  useEffect(() => {
    if (!replyingTo) {
      setText(draftStore.content)
      setImageMetadata(draftStore.imageMetadata)
    }
  }, [])

  // Save to draft store for new posts
  useEffect(() => {
    if (!replyingTo && text !== draftStore.content) {
      draftStore.setContent(text)
    }
  }, [text, replyingTo])

  useEffect(() => {
    if (!replyingTo && imageMetadata !== draftStore.imageMetadata) {
      draftStore.setImageMetadata(imageMetadata)
    }
  }, [imageMetadata, replyingTo])

  useEffect(() => {
    if (autofocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autofocus])

  // Handle click outside for inline variant with expandOnFocus
  useEffect(() => {
    if (!expandOnFocus) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (!text.trim()) {
          setIsFocused(false)
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [text, expandOnFocus])

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"
    }
  }

  useEffect(() => {
    if (!expandOnFocus || isFocused || text) {
      adjustTextareaHeight()
    }
  }, [text, isFocused, expandOnFocus])

  const handleSubmit = async () => {
    if (!myPubKey || !ndkInstance || !text.trim() || publishing) return

    setPublishing(true)
    try {
      const event = new NDKEvent(ndkInstance)
      event.kind = NDKKind.Text
      event.content = text
      event.tags = []

      if (replyingTo) {
        const rootTag = replyingTo.tagValue("e")
        const rootEvent = rootTag || replyingTo.id
        event.tags.push(["e", rootEvent, "", "root"])
        event.tags.push(["e", replyingTo.id, "", "reply"])

        const pTags = new Set<string>()
        pTags.add(replyingTo.pubkey)

        replyingTo.tags
          .filter((tag) => tag[0] === "p")
          .forEach((tag) => pTags.add(tag[1]))

        pTags.forEach((pubkey) => {
          if (pubkey !== myPubKey) {
            event.tags.push(["p", pubkey])
          }
        })
      }

      // Add image metadata tags
      Object.entries(imageMetadata).forEach(([url, metadata]) => {
        if (text.includes(url)) {
          event.tags.push([
            "imeta",
            `url ${url}`,
            `dim ${metadata.width}x${metadata.height}`,
            `blurhash ${metadata.blurhash}`,
          ])
        }
      })

      // Add geohash tags
      geohashes.forEach((hash) => {
        event.tags.push(["g", hash])
      })

      await event.publish()

      setText("")
      setImageMetadata({})
      setIsFocused(false)
      if (!replyingTo) {
        draftStore.reset()
      }
      resetGeohashes()
      onClose?.()
      onPublishCallback?.()

      // Navigate to the post if not a reply
      if (!replyingTo) {
        navigate(`/${nip19.noteEncode(event.id)}`)
      }
    } catch (error) {
      console.error("Failed to publish note:", error)
    } finally {
      setPublishing(false)
    }
  }

  const handleUpload = (
    url: string,
    metadata?: {width: number; height: number; blurhash: string}
  ) => {
    setText((prev) => prev + (prev ? "\n" : "") + url)
    if (metadata) {
      setImageMetadata((prev) => ({...prev, [url]: metadata}))
    }
  }

  const handleEmojiSelect = (emoji: {native: string}) => {
    const cursorPos = textareaRef.current?.selectionStart || text.length
    const newText = text.slice(0, cursorPos) + emoji.native + text.slice(cursorPos)
    setText(newText)

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = cursorPos + emoji.native.length
        textareaRef.current.selectionStart = newCursorPos
        textareaRef.current.selectionEnd = newCursorPos
        textareaRef.current.focus()
      }
    }, 0)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      if (!text.trim() && expandOnFocus) {
        setIsFocused(false)
        textareaRef.current?.blur()
      }
    }
  }

  if (!myPubKey) return null

  const isModal = variant === "modal"
  const shouldExpand = !expandOnFocus || isFocused || text.trim()
  const containerClass = isModal
    ? "flex flex-col gap-4 pt-4"
    : `border-b border-custom ${className}`

  return (
    <div ref={containerRef} className={containerClass}>
      {isModal && replyingTo && (
        <div className="opacity-75 px-4">
          <Link to={`/${nip19.neventEncode({id: replyingTo.id})}`}>
            <div className="flex items-center gap-2">
              <Avatar pubKey={replyingTo.pubkey} width={32} showBadge={false} />
              <span className="text-sm">Replying to</span>
            </div>
          </Link>
          <div className="ml-12 mt-1 text-sm opacity-90 line-clamp-3">
            {replyingTo.content}
          </div>
        </div>
      )}

      <div className={isModal ? "flex gap-4 px-4" : "flex gap-3 px-4 py-3"}>
        <Link to={`/${nip19.npubEncode(myPubKey)}`} className="flex-shrink-0">
          <Avatar pubKey={myPubKey} width={40} showBadge={false} />
        </Link>

        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full bg-transparent resize-none outline-none placeholder-base-content/50 ${
              isModal ? "textarea border-0 focus:outline-none p-0 text-lg" : ""
            }`}
            style={{
              minHeight: (() => {
                if (isModal) return "120px"
                if (shouldExpand) return "80px"
                return "32px"
              })(),
              height: shouldExpand ? "auto" : "32px",
              overflow: shouldExpand ? "visible" : "hidden",
            }}
          />

          {showPreview && text && (
            <div className="mt-4">
              <div className="text-sm font-semibold mb-2">Preview:</div>
              <div className="whitespace-pre-wrap break-words">{text}</div>
            </div>
          )}
        </div>
      </div>

      {geohashes.length > 0 && (
        <div className={isModal ? "px-4" : "px-4 pb-2"}>
          <GeohashDisplay />
        </div>
      )}

      {(isModal || shouldExpand) && (
        <div className={isModal ? "px-4 pb-4" : "px-4 pb-3"}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <EmojiButton onEmojiSelect={handleEmojiSelect} position="auto" />
              <UploadButton
                onUpload={handleUpload}
                multiple={true}
                className="btn btn-ghost btn-circle btn-sm md:btn-md"
                text={<RiAttachment2 className="w-6 h-6" />}
              />
              <LocationButton />
            </div>

            <div className="flex items-center gap-2">
              {isModal && onClose && (
                <button onClick={onClose} className="btn btn-ghost btn-sm">
                  Cancel
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || publishing}
                className="btn btn-primary btn-sm"
              >
                {(() => {
                  if (publishing) {
                    return <span className="loading loading-spinner loading-xs" />
                  }
                  if (replyingTo) {
                    return "Reply"
                  }
                  return "Post"
                })()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
