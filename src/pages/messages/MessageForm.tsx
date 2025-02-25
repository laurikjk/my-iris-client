import {FormEvent, useState, useEffect, useRef, lazy, Suspense} from "react"
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

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscKey)
    }
  }, [showEmojiPicker])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
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

  const handleEmojiClick = (emojiData: any) => {
    setNewMessage((prev) => prev + emojiData.emoji)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  return (
    <footer className="border-t border-custom fixed md:sticky bottom-0 w-full pb-[env(safe-area-inset-bottom)] bg-base-200">
      <form onSubmit={handleSubmit} className="flex p-4 relative">
        <div className="relative flex-1 flex gap-4 items-center">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="btn btn-ghost btn-circle btn-sm"
          >
            <RiEmotionLine size={20} />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
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
                <EmojiPicker onEmojiClick={handleEmojiClick} />
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
