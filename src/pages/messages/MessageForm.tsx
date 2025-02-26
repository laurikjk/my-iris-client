import {FormEvent, useState, useEffect, useRef, lazy, Suspense, ChangeEvent} from "react"
import {CHAT_MESSAGE_KIND, serializeSessionState, Session} from "nostr-double-ratchet"
import {RiEmotionLine, RiCloseLine} from "@remixicon/react"
import {NDKEventFromRawEvent} from "@/utils/nostr"
import Icon from "@/shared/components/Icons/Icon"
import {MessageType} from "./Message"
import {localState} from "irisdb"
import { Name } from "@/shared/components/user/Name"

interface MessageFormProps {
  session: Session
  id: string
  replyingTo?: MessageType
  setReplyingTo: (message?: MessageType) => void
}

// Lazy load the emoji picker
const EmojiPicker = lazy(() => import("emoji-picker-react"))

const MessageForm = ({session, id, replyingTo, setReplyingTo}: MessageFormProps) => {
  const [newMessage, setNewMessage] = useState("")
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const theirPublicKey = id.split(":")[0]

  useEffect(() => {
    const checkTouchDevice = () => {
      setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0)
    }

    checkTouchDevice()
    window.addEventListener("touchstart", checkTouchDevice)

    return () => {
      window.removeEventListener("touchstart", checkTouchDevice)
    }
  }, [])

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

  const handleEmojiClick = (emojiData: any) => {
    // Simply add the emoji to the message
    setNewMessage((prev) => prev + emojiData.emoji)

    // Input will be focused by the useEffect that watches showEmojiPicker
  }

  return (
    <footer className="border-t border-custom fixed md:sticky bottom-0 w-full pb-[env(safe-area-inset-bottom)] bg-base-200">
      {replyingTo && (
        <div className="px-4 pt-2 flex items-center">
          <div className="flex-1">
            <div className="text-xs text-base-content/60 mb-1 font-bold">
              {replyingTo.sender === "user" ? "You" : <Name pubKey={theirPublicKey} />}
            </div>
            <div className="text-sm truncate border-l-2 border-primary pl-2">
              {replyingTo.content}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(undefined)}
            className="btn btn-ghost btn-circle btn-sm"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>
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
            className="flex-1 input input-sm md:input-md input-bordered pl-12"
          />
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="absolute bottom-14 left-0 z-10">
              <Suspense
                fallback={
                  <div className="p-4 bg-base-100 rounded shadow">Loading...</div>
                }
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  searchPlaceholder="Search emoji..."
                  autoFocusSearch={true}
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
