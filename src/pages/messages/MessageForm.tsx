import {FormEvent, useState, useEffect, useRef, lazy, Suspense, ChangeEvent} from "react"
import {CHAT_MESSAGE_KIND, serializeSessionState, Session} from "nostr-double-ratchet"
import MessageFormReplyPreview from "./MessageFormReplyPreview"
import {isTouchDevice} from "@/shared/utils/isTouchDevice"
import {NDKEventFromRawEvent} from "@/utils/nostr"
import Icon from "@/shared/components/Icons/Icon"
import {RiEmotionLine} from "@remixicon/react"
import {localState} from "irisdb/src"
import {MessageType} from "./Message"

interface MessageFormProps {
  session: Session
  id: string
  replyingTo?: MessageType
  setReplyingTo: (message?: MessageType) => void
}

// Lazy load emoji-mart instead of emoji-picker-react
const EmojiPicker = lazy(() => import("@emoji-mart/react"))

const MessageForm = ({session, id, replyingTo, setReplyingTo}: MessageFormProps) => {
  const [newMessage, setNewMessage] = useState("")
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const theirPublicKey = id.split(":")[0]

  // Add data import for emoji-mart
  const [emojiData, setEmojiData] = useState<any>(null)

  // Load emoji data
  useEffect(() => {
    if (showEmojiPicker && !emojiData) {
      import("@emoji-mart/data")
        .then((module) => module.default)
        .then((data) => {
          setEmojiData(data)
        })
    }
  }, [showEmojiPicker, emojiData])

  useEffect(() => {
    if (!isTouchDevice && inputRef.current) {
      inputRef.current.focus()
    }
  }, [id, isTouchDevice])

  useEffect(() => {
    // Close emoji picker when clicking outside
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

    // Close emoji picker when pressing Escape key
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showEmojiPicker) {
          setShowEmojiPicker(false)
        } else if (replyingTo) {
          setReplyingTo(undefined)
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscKey)

    // Focus input whenever emoji picker is closed
    if (!showEmojiPicker && !isTouchDevice && inputRef.current) {
      inputRef.current.focus()
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscKey)
    }
  }, [showEmojiPicker, replyingTo, setReplyingTo])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setShowEmojiPicker(false)
    const text = newMessage.trim()
    if (text) {
      const time = Date.now()
      const tags = [["ms", time.toString()]]
      if (replyingTo) {
        tags.push(["e", replyingTo.id])
      }
      const {event, innerEvent} = session.sendEvent({
        content: text,
        kind: CHAT_MESSAGE_KIND,
        tags,
      })
      const ndkEvent = NDKEventFromRawEvent(event)
      ndkEvent
        .publish()
        .then(() => {})
        .catch((e) => console.error(e))
      const message: MessageType = {
        ...innerEvent,
        sender: "user",
        reactions: {},
      }
      localState
        .get("sessions")
        .get(id)
        .get("state")
        .put(serializeSessionState(session.state))
      localState.get("sessions").get(id).get("events").get(innerEvent.id).put(message)
      localState.get("sessions").get(id).get("latest").put(message)
      localState.get("sessions").get(id).get("lastSeen").put(time)
      setNewMessage("")
      if (replyingTo) {
        setReplyingTo(undefined)
      }
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setNewMessage(value)
  }

  const handleEmojiClick = (emoji: any) => {
    // emoji-mart returns different structure than emoji-picker-react
    setNewMessage((prev) => prev + emoji.native)
  }

  return (
    <footer className="border-t border-custom fixed md:sticky bottom-0 w-full pb-[env(safe-area-inset-bottom)] bg-base-200">
      {replyingTo && (
        <MessageFormReplyPreview
          replyingTo={replyingTo}
          setReplyingTo={setReplyingTo}
          theirPublicKey={theirPublicKey}
        />
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 p-4 relative">
        <div className="relative flex-1 flex gap-2 items-center">
          {!isTouchDevice && (
            <button
              type="button"
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker)
              }}
              className="btn btn-ghost btn-circle btn-sm md:btn-md left-2"
            >
              <RiEmotionLine className="w-6 w-6" />
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            placeholder="Message"
            className="flex-1 input input-sm md:input-md input-bordered"
          />
          {showEmojiPicker && emojiData && (
            <div ref={emojiPickerRef} className="absolute bottom-14 left-0 z-10">
              <Suspense
                fallback={
                  <div className="p-4 bg-base-100 rounded shadow">Loading...</div>
                }
              >
                <EmojiPicker
                  data={emojiData}
                  onEmojiSelect={handleEmojiClick}
                  autoFocus={!isTouchDevice}
                  searchPosition="sticky"
                  previewPosition="none"
                  skinTonePosition="none"
                  theme="auto"
                />
              </Suspense>
            </div>
          )}
        </div>
        <button
          type="submit"
          className={`btn btn-primary btn-circle btn-sm md:btn-md ${isTouchDevice ? "" : "hidden"}`}
        >
          <Icon name="arrow-right" className="-rotate-90" />
        </button>
      </form>
    </footer>
  )
}

export default MessageForm
