import {ChangeEvent, useState, useRef, useEffect, KeyboardEvent} from "react"
import {NDKEvent, NDKTag} from "@nostr-dev-kit/ndk"
import {RiSendPlaneFill, RiAttachment2} from "@remixicon/react"
import {nip19} from "nostr-tools"
import {useNavigate, Link} from "@/navigation"

import UploadButton from "@/shared/components/button/UploadButton"
import EmojiButton from "@/shared/components/emoji/EmojiButton"
import {Avatar} from "@/shared/components/user/Avatar"
import {isTouchDevice} from "@/shared/utils/isTouchDevice"
import {eventsByIdCache} from "@/utils/memcache"
import {usePublicKey} from "@/stores/user"
import {ndk} from "@/utils/ndk"
import {useDraftStore} from "@/stores/draft"

interface InlineNoteCreatorProps {
  onPublish?: (event: NDKEvent) => void
  repliedEvent?: NDKEvent
  quotedEvent?: NDKEvent
  placeholder?: string
  className?: string
  showButtonsAlways?: boolean
  useDraftStore?: boolean
}

function InlineNoteCreator({
  onPublish,
  repliedEvent,
  quotedEvent,
  placeholder = "What's on your mind?",
  className = "",
  showButtonsAlways = false,
  useDraftStore: useDraft = true,
}: InlineNoteCreatorProps) {
  const myPubKey = usePublicKey()
  const navigate = useNavigate()
  const [isFocused, setIsFocused] = useState(false)

  // Use draft store or local state based on prop
  const draftStore = useDraftStore()
  const [localContent, setLocalContent] = useState("")
  const [localImageMetadata, setLocalImageMetadata] = useState<
    Record<string, {width: number; height: number; blurhash: string}>
  >({})

  const content = useDraft ? draftStore.content : localContent
  const imageMetadata = useDraft ? draftStore.imageMetadata : localImageMetadata
  const setContent = useDraft ? draftStore.setContent : setLocalContent
  const setImageMetadata = useDraft ? draftStore.setImageMetadata : setLocalImageMetadata
  const resetDraft = useDraft
    ? draftStore.reset
    : () => {
        setLocalContent("")
        setLocalImageMetadata({})
      }
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (quotedEvent) {
      const quote = `nostr:${quotedEvent.encode()}`
      if (!content.includes(quote)) {
        setContent(`\n\n${quote}`)
      }
    }
  }, [quotedEvent])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (!content.trim()) {
          setIsFocused(false)
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [content])

  useEffect(() => {
    if (textareaRef.current && isFocused) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [content, isFocused])

  const handleContentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value)
  }

  const handleUpload = (
    url: string,
    metadata?: {width: number; height: number; blurhash: string}
  ) => {
    setContent((prev) => prev + `\n${url}\n`)

    if (metadata) {
      setImageMetadata({...imageMetadata, [url]: metadata})
    }
  }

  const handleEmojiSelect = (emoji: {native: string}) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart
      const end = textareaRef.current.selectionEnd
      const textBeforeCursor = content.substring(0, start)
      const textAfterCursor = content.substring(end)
      setContent(textBeforeCursor + emoji.native + textAfterCursor)

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          const newPosition = start + emoji.native.length
          textareaRef.current.setSelectionRange(newPosition, newPosition)
        }
      }, 0)
    }
  }

  const addTags = (event: NDKEvent) => {
    const uniquePTags = new Set<string>()
    const eTags: NDKTag[] = []
    const otherTags: NDKTag[] = []

    if (event.pubkey) {
      uniquePTags.add(event.pubkey)
    }

    event.tags.forEach((tag) => {
      if (tag[0] === "p" && tag[1]?.trim()) {
        uniquePTags.add(tag[1])
      } else if (tag[0] === "e" && tag[1]?.trim()) {
        eTags.push(tag)
      } else if (tag[0] !== "p" && tag[0] !== "e") {
        otherTags.push(tag)
      }
    })

    if (repliedEvent) {
      if (repliedEvent.pubkey?.trim()) {
        uniquePTags.add(repliedEvent.pubkey)
      }
      if (repliedEvent.id?.trim()) {
        const rootEventTag = repliedEvent.tags.find(
          (tag) => tag[0] === "e" && tag[3] === "root"
        )
        const isDirectReply =
          !rootEventTag &&
          !repliedEvent.tags.find((tag) => tag[0] === "e" && tag[3] === "reply")
        if (rootEventTag) {
          eTags.push(rootEventTag)
        }
        eTags.push([
          "e",
          repliedEvent.id,
          "",
          isDirectReply ? "root" : "reply",
          repliedEvent.pubkey,
        ])
      }
      repliedEvent.tags.forEach((tag) => {
        if (tag[0] === "p" && tag[1]?.trim()) {
          uniquePTags.add(tag[1])
        }
      })
    }

    if (quotedEvent) {
      if (quotedEvent.pubkey?.trim()) {
        uniquePTags.add(quotedEvent.pubkey)
      }
      if (quotedEvent.id?.trim()) {
        eTags.push(["e", quotedEvent.id, "", "mention", quotedEvent.pubkey])
      }
      quotedEvent.tags.forEach((tag) => {
        if (tag[0] === "p" && tag[1]?.trim()) {
          uniquePTags.add(tag[1])
        }
      })
    }

    const validPTags = Array.from(uniquePTags).filter(Boolean)

    event.tags = [
      ...validPTags.map<NDKTag>((pubkey) => ["p", pubkey]),
      ...eTags,
      ...otherTags,
    ]

    return event
  }

  const publish = async () => {
    if (!content.trim()) return

    const event = new NDKEvent(ndk())
    event.kind = 1
    event.content = content
    event.tags = []

    Object.entries(imageMetadata).forEach(([url, metadata]) => {
      if (content.includes(url)) {
        event.tags.push([
          "imeta",
          `url ${url}`,
          `dim ${metadata.width}x${metadata.height}`,
          `blurhash ${metadata.blurhash}`,
        ])
      }
    })

    addTags(event)

    try {
      await event.sign()
      eventsByIdCache.set(event.id, event)
      resetDraft()
      setIsFocused(false)

      // Blur the textarea to close the form
      textareaRef.current?.blur()

      if (onPublish) {
        onPublish(event)
      }

      // Navigate to the post if not a reply
      if (!repliedEvent) {
        navigate(`/${nip19.noteEncode(event.id)}`)
      }

      // Publish in the background
      event.publish().catch((error) => {
        console.warn(`Note could not be published: ${error}`)
      })
    } catch (error) {
      console.warn(`Note could not be signed: ${error}`)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      publish()
    } else if (e.key === "Escape") {
      e.preventDefault()
      if (!content.trim()) {
        setIsFocused(false)
        textareaRef.current?.blur()
      }
    }
  }

  if (!myPubKey) return null

  return (
    <div ref={containerRef} className={`border-b border-custom ${className}`}>
      <div className="flex gap-3 px-4 py-3">
        <Link to={`/${nip19.npubEncode(myPubKey)}`} className="flex-shrink-0">
          <Avatar pubKey={myPubKey} width={40} showBadge={false} />
        </Link>
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full bg-transparent resize-none outline-none placeholder-base-content/50 ${
              isFocused ? "min-h-[80px]" : "min-h-[32px]"
            }`}
            style={{
              height: isFocused ? "auto" : "32px",
              overflow: isFocused ? "visible" : "hidden",
            }}
          />
        </div>
      </div>

      {(showButtonsAlways || isFocused || content.trim()) && (
        <div className="flex justify-between items-center px-4 pb-3 gap-2">
          <div className="flex gap-2">
            <UploadButton
              onUpload={handleUpload}
              multiple={true}
              className="btn btn-ghost btn-circle btn-sm md:btn-md left-2"
              text={<RiAttachment2 className="w-6 h-6" />}
            />
            {!isTouchDevice && <EmojiButton onEmojiSelect={handleEmojiSelect} />}
          </div>
          <button
            className="btn btn-primary btn-sm gap-1"
            onClick={publish}
            disabled={!content.trim()}
          >
            <RiSendPlaneFill className="w-4 h-4" />
            <span className="hidden sm:inline">Post</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default InlineNoteCreator
