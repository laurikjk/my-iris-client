import {FormEvent, useState, useEffect, useRef} from "react"
import {NDKEventFromRawEvent} from "@/utils/nostr"
import Icon from "@/shared/components/Icons/Icon"
import {Session} from "nostr-double-ratchet"
import {MessageType} from "./Message"
import {localState} from "irisdb"

interface MessageFormProps {
  session: Session
  id: string
  onSubmit: () => void
}

const MessageForm = ({session, id, onSubmit}: MessageFormProps) => {
  const [newMessage, setNewMessage] = useState("")
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
      localState.get("sessions").get(id).get("events").get(event.id).put(message)
      localState.get("sessions").get(id).get("latest").put(message)
      localState.get("sessions").get(id).get("lastSeen").put(time)
      setNewMessage("")
    }
    onSubmit()
  }

  return (
    <footer className="p-4 border-t border-custom sticky bottom-0 bg-base-200">
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Message"
          className="flex-1 input input-sm md:input-md input-bordered"
        />
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
