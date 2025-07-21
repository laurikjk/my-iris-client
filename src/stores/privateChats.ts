import {createJSONStorage, persist} from "zustand/middleware"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {MessageType} from "@/pages/chats/message/Message"
import {comparator} from "@/pages/chats/utils/messageGrouping"
import {useUserRecordsStore} from "./userRecords"
import {useEventsStore} from "./events"
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
  getMessages: (userPubKey: string) => SortedMap<string, MessageType>
  getUserSessions: (userPubKey: string) => string[]
  addChat: (userPubKey: string) => void
  removeChat: (userPubKey: string) => void
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
        // Ensure chat exists
        if (!get().chats.has(userPubKey)) {
          get().addChat(userPubKey)
        }

        const myPubKey = useUserStore.getState().publicKey
        // Always send to recipient
        const recipientPromise = useUserRecordsStore
          .getState()
          .sendToUser(userPubKey, event)
        // If recipient is not self, also send to self
        if (userPubKey !== myPubKey) {
          // Add ['p', recipientPubKey] to event for self
          const eventForSelf = {
            ...event,
            tags: [...(event.tags || []), ["p", userPubKey]],
          }
          await Promise.all([
            recipientPromise,
            useUserRecordsStore.getState().sendToUser(myPubKey, eventForSelf),
          ])
          return userPubKey
        } else {
          await recipientPromise
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
      getMessages: (userPubKey: string): SortedMap<string, MessageType> => {
        const events = useEventsStore.getState().events
        // Since we now store messages by userPubKey directly, just get them from events store
        return (
          events.get(userPubKey) ?? new SortedMap<string, MessageType>([], comparator)
        )
      },
      getUserSessions: (userPubKey: string): string[] => {
        const sessions = useUserRecordsStore.getState().sessions
        return Array.from(sessions.keys()).filter((sessionId) =>
          sessionId.startsWith(`${userPubKey}:`)
        )
      },
      addChat: (userPubKey: string) => {
        const chats = new Map(get().chats)
        if (!chats.has(userPubKey)) {
          chats.set(userPubKey, {lastSeen: 0})
          set({chats})
        }
      },
      removeChat: (userPubKey: string) => {
        const chats = new Map(get().chats)
        chats.delete(userPubKey)
        set({chats})
      },
      getChatsList: () => {
        const sessions = useUserRecordsStore.getState().sessions
        const chats = get().chats
        const myPubKey = useUserStore.getState().publicKey

        // Get all users we have sessions with
        const userPubKeys = new Set<string>()
        Array.from(sessions.keys()).forEach((sessionId) => {
          const userPubKey = sessionId.split(":")[0]
          userPubKeys.add(userPubKey)
        })

        // Also check if we have messages stored for our own pubkey (self-chat)
        if (myPubKey) {
          const events = useEventsStore.getState().events
          const myMessages = events.get(myPubKey)
          if (myMessages && myMessages.size > 0) {
            userPubKeys.add(myPubKey)
          }
        }

        // Convert to chat list format
        return Array.from(userPubKeys)
          .map((userPubKey) => {
            const messages = get().getMessages(userPubKey)
            const lastMessage = messages.last()?.[1]
            const chatData = chats.get(userPubKey) || {lastSeen: 0}

            // Calculate unread count
            const unreadCount = Array.from(messages.values()).filter((msg) => {
              if (msg.pubkey === "user") return false // Don't count our own messages
              const msgTime = msg.created_at ? msg.created_at * 1000 : 0
              return msgTime > chatData.lastSeen
            }).length

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
  useUserRecordsStore.getState().listenToUserDevices(publicKey)
}
