import {usePrivateMessagesStore} from "@/stores/privateMessages"

export const useMessageDeletion = () => {
  const deleteMessageLocally = (messageId: string, sessionId: string) => {
    const confirmed = confirm(
      "Delete this message locally? This will only remove it from your device and cannot be undone."
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
