import {usePrivateMessagesStore} from "@/stores/privateMessages"
import {confirm} from "@/utils/utils"

export const useMessageDeletion = () => {
  const deleteMessageLocally = async (messageId: string, sessionId: string) => {
    const confirmed = await confirm(
      "This will only remove it from your device and cannot be undone.",
      "Delete this message locally?"
    )

    if (confirmed) {
      // Remove the message from the events store
      const {events} = usePrivateMessagesStore.getState()
      const sessionEvents = events.get(sessionId)

      if (sessionEvents) {
        sessionEvents.delete(messageId)
        // Force re-render by updating the store
        usePrivateMessagesStore.setState({events: new Map(events)})
      }

      return true // Deletion confirmed and executed
    }

    return false // Deletion cancelled
  }

  return {deleteMessageLocally}
}
