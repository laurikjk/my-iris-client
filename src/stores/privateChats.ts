import {createJSONStorage, persist} from "zustand/middleware"
import {MessageType} from "@/pages/chats/message/Message"
import {comparator} from "@/pages/chats/utils/messageGrouping"
import {useUserRecordsStore} from "./userRecords"
import {usePrivateMessagesStore} from "./privateMessages"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import localforage from "localforage"
import {create} from "zustand"
import {UnsignedEvent} from "nostr-tools"
import {useUserStore} from "./user"

interface PrivateChatsStoreState {
  chats: Map<string, {lastSeen: number}> // userPubKey -> chat metadata
}

interface PrivateChatsStoreActions {
  sendToUser: (userPubKey: string, event: Partial<UnsignedEvent>) => Promise<string>
  updateLastSeen: (userPubKey: string) => void
  getChatsList: () => Array<{
    userPubKey: string
    lastMessage?: MessageType
    lastMessageTime: number
    unreadCount: number
  }>
}

type PrivateChatsStore = PrivateChatsStoreState & PrivateChatsStoreActions

export const usePrivateChatsStore = create<PrivateChatsStore>()(
  persist(
    (set, get) => ({
      chats: new Map(),
      sendToUser: async (userPubKey: string, event: Partial<UnsignedEvent>) => {
        const myPubKey = useUserStore.getState().publicKey
        // Always send to recipient
        const recipientPromise = useUserRecordsStore
          .getState()
          .sendToUser(userPubKey, event)
        // If recipient is not self, also send to self
        if (userPubKey !== myPubKey) {
          // Send same event to self (no p tag needed)
          await Promise.all([
            recipientPromise,
            useUserRecordsStore.getState().sendToUser(myPubKey, event),
          ])
          return userPubKey
        } else {
          // When sending to self, we still need to ensure proper routing
          // Add ['p', myPubKey] tag to help with routing
          const eventWithPTag = {
            ...event,
            tags: [...(event.tags || []), ["p", myPubKey]],
          }
          await useUserRecordsStore.getState().sendToUser(myPubKey, eventWithPTag)
          return myPubKey
        }
      },
      updateLastSeen: (userPubKey: string) => {
        const chats = new Map(get().chats)
        const chat = chats.get(userPubKey) || {lastSeen: 0}
        chat.lastSeen = Date.now()
        chats.set(userPubKey, chat)
        set({chats})
      },
      getChatsList: () => {
        const userRecords = useUserRecordsStore.getState().userRecords
        const chats = get().chats

        // Get all users we have active sessions with (from userRecords, not sessions)
        const userPubKeys = new Set<string>()

        for (const [userPubKey, userRecord] of userRecords.entries()) {
          // Only include users with active sessions
          if (userRecord.hasActiveSessions()) {
            userPubKeys.add(userPubKey)
          }
        }

        // Also include users we have in the chats store (for persistence)
        for (const userPubKey of chats.keys()) {
          userPubKeys.add(userPubKey)
        }

        // Convert to chat list format
        return Array.from(userPubKeys)
          .map((userPubKey) => {
            // Get messages directly from events store
            const events = usePrivateMessagesStore.getState().events
            const messages =
              events.get(userPubKey) ?? new SortedMap<string, MessageType>([], comparator)
            const lastMessage = messages.last()?.[1]
            const chatData = chats.get(userPubKey) || {lastSeen: 0}

            // Calculate unread count
            const myPubKey = useUserStore.getState().publicKey
            const unreadCount = Array.from(messages.values()).filter(
              (msg: MessageType) => {
                if (msg.pubkey === myPubKey) return false // Don't count our own messages
                const msgTime = msg.created_at ? msg.created_at * 1000 : 0
                return msgTime > chatData.lastSeen
              }
            ).length

            return {
              userPubKey,
              lastMessage,
              lastMessageTime: lastMessage?.created_at
                ? lastMessage.created_at * 1000
                : 0,
              unreadCount,
            }
          })
          .sort((a, b) => b.lastMessageTime - a.lastMessageTime)
      },
    }),
    {
      name: "privateChats",
      storage: createJSONStorage(() => localforage),
      partialize: (state: PrivateChatsStore) => ({
        chats: Array.from(state.chats.entries()),
      }),
      merge: (persistedState: unknown, currentState: PrivateChatsStore) => {
        const state = (persistedState || {chats: []}) as {
          chats: [string, {lastSeen: number}][]
        }
        return {
          ...currentState,
          chats: new Map(state.chats || []),
        }
      },
    }
  )
)

let ownDeviceInvitesInitialized = false

// Reset the initialization flag (useful when user changes)
export function resetDeviceInvitesInitialization() {
  ownDeviceInvitesInitialized = false
}

// Helper to subscribe to own device invites after stores are initialized
export async function subscribeToOwnDeviceInvites() {
  const publicKey = useUserStore.getState().publicKey
  console.log("subscribeToOwnDeviceInvites", publicKey)

  if (!publicKey) {
    return
  }

  // Prevent multiple initializations
  if (ownDeviceInvitesInitialized) {
    console.log("Own device invites already initialized, skipping")
    return
  }

  ownDeviceInvitesInitialized = true

  // Import here to avoid circular dependency at module scope
  const {useUserRecordsStore} = await import("./userRecords")

  // Initialize listeners for current device's invite
  useUserRecordsStore.getState().initializeListeners()

  // Wait a bit to ensure sessions are fully loaded from storage before listening for invites
  // This prevents re-accepting invites we already have sessions for
  setTimeout(() => {
    console.log("Starting to listen for device invites after delay")
    // Then start listening for new device invites from other devices
    useUserRecordsStore.getState().listenToUserDevices(publicKey)
  }, 2000) // 2 second delay to ensure session data is loaded
}
