// import {getMillisecondTimestamp} from "nostr-double-ratchet/src" // TEMP: Unused
// import {useUserRecordsStore} from "@/stores/userRecords" // TEMP: Removed
// import {usePrivateMessagesStore} from "@/stores/privateMessages" // TEMP: Unused
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {MessageType} from "@/pages/chats/message/Message"
// import {useMemo} from "react" // TEMP: Unused
import {useUserStore} from "@/stores/user"

interface UnseenMessagesBadgeProps {
  messages?: SortedMap<string, MessageType>
  lastSeen?: number
}

const UnseenMessagesBadge = ({messages, lastSeen}: UnseenMessagesBadgeProps) => {
  // TEMP: Dummy global last seen data and events
  // const globalLastSeen = new Map<string, number>()
  // const {events} = usePrivateMessagesStore()

  // TEMP: Always return false for unread
  const hasUnread = false

  // If props are provided, use them (for specific session usage)
  if (messages && lastSeen !== undefined) {
    const unseenMessages = Array.from(messages.entries())
      .filter(([, message]) => {
        if (!message.created_at) return false
        const myPubKey = useUserStore.getState().publicKey
        if (message.pubkey === myPubKey) return false
        return message.created_at * 1000 > lastSeen
      })
      .slice(-10)

    if (unseenMessages.length === 0) {
      return null
    }

    return (
      <div className="flex items-center gap-1">
        <span className="badge badge-primary badge-sm">{unseenMessages.length}</span>
      </div>
    )
  }

  // Global usage - return the unread indicator
  return (
    <>
      {hasUnread && <div className="indicator-item badge badge-primary badge-xs"></div>}
    </>
  )
}

export default UnseenMessagesBadge
