import {useState} from "react"
import {ndk} from "@/utils/ndk"

export const useRebroadcast = () => {
  const [isRebroadcasting, setIsRebroadcasting] = useState(false)
  const [rebroadcastSuccess, setRebroadcastSuccess] = useState(false)

  const rebroadcast = async (eventId: string) => {
    setIsRebroadcasting(true)
    setRebroadcastSuccess(false)

    try {
      // Find the event by ID
      const event = await ndk().fetchEvent(eventId)

      if (event) {
        // Republish to all connected relays
        await event.publish()
        setRebroadcastSuccess(true)
        setTimeout(() => setRebroadcastSuccess(false), 3000)
        return true
      } else {
        console.error("Event not found for rebroadcast")
        return false
      }
    } catch (error) {
      console.error("Failed to rebroadcast event:", error)
      return false
    } finally {
      setIsRebroadcasting(false)
    }
  }

  return {
    rebroadcast,
    isRebroadcasting,
    rebroadcastSuccess,
  }
}
