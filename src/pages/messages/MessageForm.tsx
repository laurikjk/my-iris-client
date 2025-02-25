import {FormEvent, useState, useEffect, useRef, lazy, Suspense, ChangeEvent} from "react"
import {serializeSessionState, Session} from "nostr-double-ratchet"
import {NDKEventFromRawEvent} from "@/utils/nostr"
import Icon from "@/shared/components/Icons/Icon"
import {RiEmotionLine} from "@remixicon/react"
import {MessageType} from "./Message"
import {localState} from "irisdb"

interface MessageFormProps {
  session: Session
  id: string
}

// Lazy load the emoji picker
const EmojiPicker = lazy(() => import("emoji-picker-react"))

const MessageForm = ({session, id}: MessageFormProps) => {
  const [newMessage, setNewMessage] = useState("")
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

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
      if (event.key === "Escape" && showEmojiPicker) {
        setShowEmojiPicker(false)
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
  }, [showEmojiPicker])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setShowEmojiPicker(false)
    const text = newMessage.trim()
    if (text) {
      const time = Date.now()
      const {event, innerEvent} = session.send(text)
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
