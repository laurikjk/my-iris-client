import {useState, useEffect, useRef, KeyboardEvent} from "react"
import {Link, useNavigate} from "@/navigation"
import {nip19} from "nostr-tools"
import {NDKEvent, NDKKind} from "@nostr-dev-kit/ndk"
import {useDraftStore, ImetaTag} from "@/stores/draft"
import EmojiButton from "@/shared/components/emoji/EmojiButton"
import {Avatar} from "@/shared/components/user/Avatar"
import {usePublicKey} from "@/stores/user"
import {ndk} from "@/utils/ndk"
import UploadButton, {type UploadState} from "@/shared/components/button/UploadButton"
import {GeohashManager} from "@/shared/components/create/GeohashManager"
import {RiAttachment2, RiMapPinLine} from "@remixicon/react"
import HyperText from "@/shared/components/HyperText"

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

  const draftKey = replyingTo?.id || ""
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
  const [uploadState, setUploadState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    currentFile: null,
    errorMessage: null,
    failedFiles: [],
    totalFiles: 0,
    currentFileIndex: 0,
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load draft when store hydrates
  useEffect(() => {
    if (!hasHydrated) return
    const draft = draftStore.getDraft(draftKey)
    if (draft) {
      setText(draft.content)
      setImeta(draft.imeta)
    }
  }, [hasHydrated, draftKey])

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

      await event.publish()

      setText("")
      setImeta([])
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

  if (!myPubKey) return null

  const isModal = variant === "modal"
  const shouldExpand = !expandOnFocus || isFocused || text.trim()
  const containerClass = isModal
    ? "flex flex-col gap-4 pt-4"
    : `border-b border-custom ${className}`

  return (
    <div ref={containerRef} className={containerClass}>
      {/* Edit/Preview toggle for modal */}
      {showPreview && isModal && text.trim() && (
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => setPreviewMode(false)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors select-none ${
              !previewMode
                ? "bg-primary text-primary-content"
                : "bg-base-200 text-base-content/60 hover:text-base-content hover:bg-base-300"
            }`}
          >
            Edit
          </button>
          <button
            onClick={() => setPreviewMode(true)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors select-none ${
              previewMode
                ? "bg-primary text-primary-content"
                : "bg-base-200 text-base-content/60 hover:text-base-content hover:bg-base-300"
            }`}
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
        <Link to={`/${nip19.npubEncode(myPubKey)}`} className="flex-shrink-0">
          <Avatar pubKey={myPubKey} width={40} showBadge={false} />
        </Link>

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
                  isModal ? "textarea border-0 focus:outline-none p-0 text-lg h-full" : ""
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
              <div className="text-lg">
                <HyperText>{text}</HyperText>
              </div>
            )}
          </div>
        </div>
      </div>

      {(isModal || shouldExpand) && (
        <div className={isModal ? "px-4 pb-4" : "px-4 pb-3"}>
          {/* Display geohashes above action bar */}
          {(() => {
            const draft = draftStore.getDraft(draftKey)
            return draft?.gTags && draft.gTags.length > 0 ? (
              <div className="flex items-center gap-2 text-sm text-base-content/70 mb-3">
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
            ) : null
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
