import {ChangeEvent, DragEvent, useEffect, useState} from "react"
import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {NDKEvent, NDKTag} from "@nostr-dev-kit/ndk"
import {uploadFile} from "@/shared/upload"
import {ndk} from "@/utils/ndk"

import UploadButton from "@/shared/components/button/UploadButton.tsx"
import FeedItem from "@/shared/components/event/FeedItem/FeedItem"
import {Avatar} from "@/shared/components/user/Avatar.tsx"
import HyperText from "@/shared/components/HyperText.tsx"

import {isTouchDevice} from "@/shared/utils/isTouchDevice"
import EmojiButton from "@/pages/messages/EmojiButton"
import {eventsByIdCache} from "@/utils/memcache"
import {useNavigate} from "react-router"
import {nip19} from "nostr-tools"
import Textarea from "./Textarea"

type handleCloseFunction = () => void

interface NoteCreatorProps {
  repliedEvent?: NDKEvent
  quotedEvent?: NDKEvent
  handleClose: handleCloseFunction
  reset?: boolean
}

function addPTags(event: NDKEvent, repliedEvent?: NDKEvent, quotedEvent?: NDKEvent) {
  const uniquePTags = new Set<string>()
  const eTags: NDKTag[] = []
  const otherTags: NDKTag[] = []

  if (event.pubkey) {
    uniquePTags.add(event.pubkey)
  }

  // Process existing tags
  event.tags.forEach((tag) => {
    if (tag[0] === "p" && tag[1]?.trim()) {
      uniquePTags.add(tag[1])
    } else if (tag[0] === "e" && tag[1]?.trim()) {
      // Store complete e-tag instead of just the ID
      eTags.push(tag)
    } else if (tag[0] !== "p" && tag[0] !== "e") {
      otherTags.push(tag)
    }
  })

  // Add p-tags from events
  if (repliedEvent) {
    if (repliedEvent.pubkey?.trim()) {
      uniquePTags.add(repliedEvent.pubkey)
    }
    // Preserve full e-tag for reply
    if (repliedEvent.id?.trim()) {
      eTags.push(["e", repliedEvent.id, "", "reply", repliedEvent.pubkey])
    }
    // Add p-tags from replied event
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
    // Preserve full e-tag for quote
    if (quotedEvent.id?.trim()) {
      eTags.push(["e", quotedEvent.id, "", "mention", quotedEvent.pubkey])
    }
    // Add p-tags from quoted event
    quotedEvent.tags.forEach((tag) => {
      if (tag[0] === "p" && tag[1]?.trim()) {
        uniquePTags.add(tag[1])
      }
    })
  }

  // Filter out any empty values and reconstruct tags array
  const validPTags = Array.from(uniquePTags).filter(Boolean)

  event.tags = [
    ...validPTags.map<NDKTag>((pubkey) => ["p", pubkey]),
    ...eTags, // Use complete e-tags instead of reconstructing
    ...otherTags,
  ]

  return event
}

function NoteCreator({handleClose, quotedEvent, repliedEvent}: NoteCreatorProps) {
  const [myPubKey] = useLocalState("user/publicKey", localStorage.getItem("pubkey"))
  const navigate = useNavigate()

  const [noteContent, setNoteContent] = useLocalState(
    repliedEvent ? "notes/replyDraft" : "notes/draft",
    ""
  )

  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [isDraggingOver, setIsDraggingOver] = useState(false)

  const handleContentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setNoteContent(event.target.value)
  }

  useEffect(() => {
    if (quotedEvent) {
      const quote = `nostr:${quotedEvent.encode()}`
      if (!noteContent.includes(quote)) {
        setNoteContent(`\n\n${quote}`)
      }
    }
  }, [quotedEvent])

  const handleUpload = (url: string) => {
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const textBeforeCursor = noteContent.substring(0, start)
      const textAfterCursor = noteContent.substring(end)

      // Check if cursor is in the middle of or adjacent to a word
      const isAdjacentToWord =
        (start > 0 && /\w/.test(noteContent[start - 1])) || /\w/.test(noteContent[end])

      if (isAdjacentToWord) {
        // If adjacent to a word, append the URL at the end
        setNoteContent(noteContent + ` ${url}`)
      } else {
        // Otherwise, insert the URL at the cursor position
        setNoteContent(textBeforeCursor + ` ${url} ` + textAfterCursor)
        // Move cursor to the end of the inserted URL
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + url.length + 2
        }, 0)
      }
    }
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingOver(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingOver(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingOver(false)
    const files = Array.from(event.dataTransfer.files)
    files.forEach((file) => {
      if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
        handleFileUpload(file)
      }
    })
  }

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    setUploadProgress(0)
    setUploadError(null)
    try {
      const url = await uploadFile(file, (progress) => {
        setUploadProgress(progress)
      })
      handleUpload(url)
    } catch (error) {
      console.error("File upload failed:", error)
      setUploadError(error instanceof Error ? error.message : String(error))
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleEmojiSelect = (emoji: any) => {
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const textBeforeCursor = noteContent.substring(0, start)
      const textAfterCursor = noteContent.substring(end)
      setNoteContent(textBeforeCursor + emoji.native + textAfterCursor)

      // Restore focus and set cursor position after the inserted emoji
      setTimeout(() => {
        textarea.focus()
        const newPosition = start + emoji.native.length
        textarea.setSelectionRange(newPosition, newPosition)
      }, 0)
    }
  }

  const publish = () => {
    const event = new NDKEvent(ndk())
    event.kind = 1
    event.content = noteContent
    event.tags = []
    if (repliedEvent) {
      event.tags = [
        ["p", repliedEvent.pubkey],
        ["e", repliedEvent.id, "", "reply", repliedEvent.pubkey],
      ]
    }
    if (quotedEvent) {
      event.tags.push(["e", quotedEvent.id, "", "mention", quotedEvent.pubkey])
    }
    addPTags(event, repliedEvent, quotedEvent)
    event.sign().then(() => {
      eventsByIdCache.set(event.id, event)
      setNoteContent("")
      handleClose()
      navigate(`/${nip19.noteEncode(event.id)}`)
    })
    event.publish().catch((error) => {
      console.warn(`Note could not be published: ${error}`)
    })
  }

  return (
    <div
      className={`rounded-lg overflow-y-auto max-h-screen md:w-[600px] ${isDraggingOver ? "bg-neutral" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {repliedEvent && (
        <div className="p-4 max-h-52 overflow-y-auto border-b border-base-content/20">
          <FeedItem
            event={repliedEvent}
            showActions={false}
            showRepliedTo={false}
            truncate={0}
          />
        </div>
      )}
      <div className="p-4 md:p-8 flex flex-col gap-4">
        <Textarea
          value={noteContent}
          onChange={handleContentChange}
          onUpload={handleFileUpload}
          onPublish={publish}
          placeholder="What's on your mind?"
          quotedEvent={quotedEvent}
          onRef={setTextarea}
        />
        {uploading && (
          <div className="w-full mt-2">
            <div className="bg-neutral rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full"
                style={{width: `${uploadProgress}%`}}
              ></div>
            </div>
            <p className="text-sm text-center mt-1">{Math.round(uploadProgress)}%</p>
          </div>
        )}
        {uploadError && <p className="text-sm text-error mt-2">{uploadError}</p>}
        <div className="flex flex-row gap-2 items-center">
          {myPubKey && <Avatar showBadge={false} pubKey={myPubKey} />}
          <UploadButton
            className="rounded-full btn btn-primary"
            onUpload={handleUpload}
            text="Upload file"
          />
          {!isTouchDevice && <EmojiButton onEmojiSelect={handleEmojiSelect} />}
          <div className="flex-1"></div>
          <button className="btn btn-ghost rounded-full" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary rounded-full"
            disabled={!noteContent}
            onClick={publish}
          >
            Publish
          </button>
        </div>
        <div className="mt-4 min-h-16 max-h-96 overflow-y-scroll">
          <div className="text-sm uppercase text-gray-500 mb-2 font-bold">Preview</div>
          <HyperText>{noteContent}</HyperText>
        </div>
      </div>
    </div>
  )
}

export default NoteCreator
