import {useState, useEffect, useRef, KeyboardEvent, DragEvent} from "react"
import {Link, useNavigate} from "@/navigation"
import {nip19} from "nostr-tools"
import {NDKEvent, NDKKind} from "@nostr-dev-kit/ndk"
import {useDraftStore, ImetaTag} from "@/stores/draft"
import EmojiButton from "@/shared/components/emoji/EmojiButton"
import {Avatar} from "@/shared/components/user/Avatar"
import {ProfileLink} from "@/shared/components/user/ProfileLink"
import {usePublicKey} from "@/stores/user"
import {ndk} from "@/utils/ndk"
import UploadButton, {type UploadState} from "@/shared/components/button/UploadButton"
import {GeohashManager} from "@/shared/components/create/GeohashManager"
import {ExpirationSelector} from "@/shared/components/create/ExpirationSelector"
import {getExpirationLabel} from "@/utils/expiration"
import {RiAttachment2, RiMapPinLine, RiTimeLine} from "@remixicon/react"
import HyperText from "@/shared/components/HyperText"

// Extract hashtags from text content per NIP-24
const extractHashtags = (text: string): string[] => {
  // Regex to match hashtags while avoiding false positives
  // - Must start with # followed by alphanumeric chars or underscore
  // - Avoid URLs like example.com/#anchor (preceded by / or .)
  // - Avoid inside URLs (preceded by ://)
  // - Must be at word boundary or start of line
  const hashtagRegex = /(?:^|[^/\w.])#([a-zA-Z0-9_]+)(?=\s|$|[^\w])/g
  const hashtags = new Set<string>()
  let match

  while ((match = hashtagRegex.exec(text)) !== null) {
    const hashtag = match[1].toLowerCase()
    // Skip very short or very long hashtags
    if (hashtag.length >= 2 && hashtag.length <= 50) {
      hashtags.add(hashtag)
    }
  }

  return Array.from(hashtags)
}

interface BaseNoteCreatorProps {
  onClose?: () => void
  replyingTo?: NDKEvent
  quotedEvent?: NDKEvent
  placeholder?: string
  autofocus?: boolean
  className?: string
  showPreview?: boolean
  variant?: "inline" | "modal"
  onPublish?: () => void
  expandOnFocus?: boolean
  alwaysExpanded?: boolean
}

export function BaseNoteCreator({
  onClose,
  replyingTo,
  quotedEvent,
  placeholder = "What's happening?",
  autofocus = false,
  className = "",
  showPreview = false,
  variant = "inline",
  onPublish: onPublishCallback,
  expandOnFocus = false,
  alwaysExpanded = false,
}: BaseNoteCreatorProps) {
  const myPubKey = usePublicKey()
  const ndkInstance = ndk()
  const draftStore = useDraftStore()
  const navigate = useNavigate()

  const draftKey = replyingTo?.id || (quotedEvent ? `quote-${quotedEvent.id}` : "") || ""
  const hasHydrated = draftStore.hasHydrated

  const [publishing, setPublishing] = useState(false)

  // Initialize state from draft store if available
  const [text, setText] = useState(() => {
    if (!hasHydrated) return ""
    const draft = draftStore.getDraft(draftKey)
    return draft?.content || ""
  })

  const [imeta, setImeta] = useState<ImetaTag[]>(() => {
    if (!hasHydrated) return []
    const draft = draftStore.getDraft(draftKey)
    return draft?.imeta || []
  })
  const [isFocused, setIsFocused] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [expirationDelta, setExpirationDelta] = useState<number | null>(() => {
    // First check if we have a saved expiration delta in draft
    if (hasHydrated) {
      const draft = draftStore.getDraft(draftKey)
      if (draft?.expirationDelta !== undefined) {
        return draft.expirationDelta
      }
    }

    // Otherwise inherit expiration from the event being replied to (convert to delta)
    if (replyingTo) {
      const expirationTag = replyingTo.tags.find(
        (tag) => tag[0] === "expiration" && tag[1]
      )
      if (expirationTag) {
        const timestamp = parseInt(expirationTag[1], 10)
        if (!isNaN(timestamp)) {
          // Calculate delta from current time
          const now = Math.floor(Date.now() / 1000)
          const delta = timestamp - now
          // Only use positive deltas
          return delta > 0 ? delta : null
        }
      }
    }
    return null
  })
  const [uploadState, setUploadState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    currentFile: null,
    errorMessage: null,
    failedFiles: [],
    totalFiles: 0,
    currentFileIndex: 0,
  })
  const [isDragOver, setIsDragOver] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load draft when store hydrates, or set quote link for new quotes
  useEffect(() => {
    if (!hasHydrated) return
    const draft = draftStore.getDraft(draftKey)
    if (draft) {
      setText(draft.content)
      setImeta(draft.imeta)
      if (draft.expirationDelta !== undefined) {
        setExpirationDelta(draft.expirationDelta)
      }
    } else if (quotedEvent && !text) {
      // Only set the quote link if there's no existing draft and no text
      const noteId = nip19.noteEncode(quotedEvent.id)
      setText(`\n\nnostr:${noteId}`)
    }
  }, [hasHydrated, draftKey, quotedEvent])

  // Save to draft store
  useEffect(() => {
    if (!hasHydrated) return
    draftStore.setDraft(draftKey, {content: text})
  }, [text, draftKey, hasHydrated])

  useEffect(() => {
    if (!hasHydrated) return
    draftStore.setDraft(draftKey, {imeta})
  }, [imeta, draftKey, hasHydrated])

  useEffect(() => {
    if (!hasHydrated) return
    draftStore.setDraft(draftKey, {expirationDelta})
  }, [expirationDelta, draftKey, hasHydrated])

  useEffect(() => {
    if (autofocus && textareaRef.current) {
      textareaRef.current.focus()
      // If we have a quoted event, position cursor at the beginning
      if (quotedEvent) {
        setTimeout(() => {
          textareaRef.current?.setSelectionRange(0, 0)
        }, 0)
      }
    }
  }, [autofocus, quotedEvent])

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

      // Add quote reference if quoting an event
      if (quotedEvent) {
        // The nostr: link is already in the text field, no need to add it again
        // Just add the q tag for the quoted event
        event.tags.push(["q", quotedEvent.id])

        // Add p tag for the quoted author if not already added
        if (
          quotedEvent.pubkey !== myPubKey &&
          !event.tags.some((tag) => tag[0] === "p" && tag[1] === quotedEvent.pubkey)
        ) {
          event.tags.push(["p", quotedEvent.pubkey])
        }
      }

      // Add imeta tags
      imeta.forEach((tag) => {
        const imetaTag = ["imeta"]
        if (tag.url) imetaTag.push(`url ${tag.url}`)
        if (tag.width && tag.height) imetaTag.push(`dim ${tag.width}x${tag.height}`)
        if (tag.blurhash) imetaTag.push(`blurhash ${tag.blurhash}`)
        if (tag.alt) imetaTag.push(`alt ${tag.alt}`)
        if (tag.m) imetaTag.push(`m ${tag.m}`)
        if (tag.x) imetaTag.push(`x ${tag.x}`)
        if (tag.size) imetaTag.push(`size ${tag.size}`)
        if (tag.dim) imetaTag.push(`dim ${tag.dim}`)
        if (tag.fallback) {
          tag.fallback.forEach((fb) => imetaTag.push(`fallback ${fb}`))
        }
        if (imetaTag.length > 1) {
          event.tags.push(imetaTag)
        }
      })

      // Add geohash tags
      const draft = draftStore.getDraft(draftKey)
      if (draft?.gTags) {
        draft.gTags.forEach((hash) => {
          event.tags.push(["g", hash])
        })
      }

      // Add hashtag tags per NIP-24
      const hashtags = extractHashtags(text)
      hashtags.forEach((hashtag) => {
        event.tags.push(["t", hashtag])
      })

      // Add expiration tag (calculate timestamp from delta)
      if (expirationDelta) {
        const now = Math.floor(Date.now() / 1000)
        const expirationTimestamp = now + expirationDelta
        event.tags.push(["expiration", expirationTimestamp.toString()])
      }

      await event.publish()

      setText("")
      setImeta([])
      setExpirationDelta(null)
      setIsFocused(false)
      draftStore.clearDraft(draftKey)
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
      const newImeta: ImetaTag = {
        url,
        width: metadata.width,
        height: metadata.height,
        blurhash: metadata.blurhash,
      }
      setImeta((prev) => [...prev, newImeta])
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

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true)
      // Expand inline note creator on drag hover
      if (!isModal && expandOnFocus && !isFocused) {
        setIsFocused(true)
      }
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only hide drag overlay if leaving the container
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      // Simulate file input change to trigger UploadButton's onChange handler
      const fileInput = containerRef.current?.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      if (fileInput) {
        // Create a new FileList-like object
        const dt = new DataTransfer()
        files.forEach((file) => dt.items.add(file))
        fileInput.files = dt.files

        // Trigger the change event
        const event = new Event("change", {bubbles: true})
        fileInput.dispatchEvent(event)
      }
    }
  }

  if (!myPubKey) return null

  const isModal = variant === "modal"
  const shouldExpand = alwaysExpanded || !expandOnFocus || isFocused || text.trim()
  const containerClass = isModal
    ? "flex flex-col gap-4 pt-4"
    : `border-b border-custom ${className}`

  return (
    <div
      ref={containerRef}
      className={`${containerClass} ${isDragOver ? "relative" : ""}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-primary/20 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center">
            <RiAttachment2 className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-primary font-medium">Drop files to upload</p>
          </div>
        </div>
      )}

      {/* Edit/Preview toggle */}
      {showPreview && shouldExpand && (
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => setPreviewMode(false)}
            className={!previewMode ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
          >
            Edit
          </button>
          <button
            onClick={() => setPreviewMode(true)}
            className={previewMode ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
          >
            Preview
          </button>
        </div>
      )}

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
        <ProfileLink pubKey={myPubKey} className="flex-shrink-0">
          <Avatar pubKey={myPubKey} width={40} showBadge={false} />
        </ProfileLink>

        <div className="flex-1">
          <div className={isModal ? "h-[300px] overflow-y-auto" : ""}>
            {!previewMode ? (
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={`w-full bg-transparent resize-none outline-none placeholder-base-content/50 ${
                  isModal
                    ? "textarea border-0 focus:outline-none p-0 text-lg h-full"
                    : "text-base"
                }`}
                style={{
                  minHeight: (() => {
                    if (isModal) return "100%"
                    if (shouldExpand) return "80px"
                    return "32px"
                  })(),
                  height: (() => {
                    if (isModal) return "100%"
                    return shouldExpand ? "auto" : "32px"
                  })(),
                  overflow: shouldExpand && !isModal ? "visible" : "hidden",
                }}
              />
            ) : (
              <div
                className={isModal ? "text-lg" : "text-base"}
                style={{
                  minHeight: (() => {
                    if (isModal) return "100%"
                    if (shouldExpand) return "80px"
                    return "32px"
                  })(),
                }}
              >
                <HyperText textPadding={false}>{text}</HyperText>
              </div>
            )}
          </div>
        </div>
      </div>

      {(isModal || shouldExpand) && (
        <div className={isModal ? "px-4 pb-4" : "px-4 pb-3"}>
          {/* Display geohashes and expiration above action bar */}
          {(() => {
            const draft = draftStore.getDraft(draftKey)
            const hasGeohash = draft?.gTags && draft.gTags.length > 0
            const hasExpiration = expirationDelta !== null

            if (!hasGeohash && !hasExpiration) return null

            return (
              <div className="flex items-center justify-between text-sm text-base-content/70 mb-3">
                {hasGeohash ? (
                  <div className="flex items-center gap-2">
                    <RiMapPinLine className="w-4 h-4" />
                    <div className="flex gap-2 flex-wrap">
                      {draft.gTags.map((gh) => (
                        <span key={gh} className="badge badge-sm">
                          {gh}
                          <button
                            onClick={() => {
                              const newGTags = draft.gTags.filter((tag) => tag !== gh)
                              draftStore.setDraft(draftKey, {gTags: newGTags})
                            }}
                            className="ml-1 hover:text-error"
                            disabled={publishing}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div />
                )}

                {hasExpiration && (
                  <div
                    className="flex items-center gap-1 text-sm text-base-content/70"
                    title={`Expires: ${new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                      timeStyle: "long",
                    }).format((Math.floor(Date.now() / 1000) + expirationDelta) * 1000)}`}
                  >
                    <RiTimeLine className="w-4 h-4" />
                    <span>Expires in {getExpirationLabel(expirationDelta)}</span>
                  </div>
                )}
              </div>
            )
          })()}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <EmojiButton onEmojiSelect={handleEmojiSelect} position="auto" />
              <UploadButton
                onUpload={handleUpload}
                multiple={true}
                className="btn btn-ghost btn-circle btn-sm md:btn-md"
                text={<RiAttachment2 className="w-6 h-6" />}
                onStateChange={setUploadState}
              />
              <GeohashManager disabled={publishing} displayInline draftKey={draftKey} />
              <ExpirationSelector
                onExpirationChange={setExpirationDelta}
                disabled={publishing}
                currentExpirationDelta={expirationDelta}
              />
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

          {/* Upload progress/error display */}
          {(uploadState.uploading ||
            uploadState.errorMessage ||
            uploadState.failedFiles.length > 0) && (
            <div className="mt-3 bg-base-200 rounded-lg p-3">
              {uploadState.uploading && (
                <div className="w-full">
                  {uploadState.currentFile && (
                    <p className="text-sm mb-2 truncate">
                      {uploadState.totalFiles > 1
                        ? `[${uploadState.currentFileIndex}/${uploadState.totalFiles}] `
                        : ""}
                      {uploadState.currentFile}
                    </p>
                  )}
                  <div className="bg-neutral rounded-full h-2.5 w-full">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all duration-300"
                      style={{width: `${uploadState.progress}%`}}
                    ></div>
                  </div>
                  <p className="text-sm text-center mt-2 font-medium">
                    {Math.round(uploadState.progress)}%
                  </p>
                </div>
              )}
              {!uploadState.uploading && uploadState.errorMessage && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-error">{uploadState.errorMessage}</p>
                  <button
                    onClick={() =>
                      setUploadState((prev) => ({
                        ...prev,
                        errorMessage: null,
                        failedFiles: [],
                      }))
                    }
                    className="btn btn-xs btn-ghost"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              {!uploadState.uploading &&
                uploadState.failedFiles.length > 0 &&
                !uploadState.errorMessage && (
                  <div>
                    <p className="text-sm font-semibold text-error mb-2">
                      Failed uploads:
                    </p>
                    <div className="max-h-32 overflow-y-auto">
                      {uploadState.failedFiles.map((file, index) => (
                        <p key={index} className="text-sm text-error truncate">
                          {file.name}: {file.error}
                        </p>
                      ))}
                    </div>
                    <button
                      onClick={() =>
                        setUploadState((prev) => ({...prev, failedFiles: []}))
                      }
                      className="btn btn-xs btn-ghost mt-2"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
