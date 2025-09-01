import {MessageType} from "@/pages/chats/message/Message"
import {comparator} from "@/pages/chats/utils/messageGrouping"
import {usePrivateMessagesStore} from "./privateMessages"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {create} from "zustand"
import {UnsignedEvent, Filter, VerifiedEvent} from "nostr-tools"
import {hexToBytes} from "@noble/hashes/utils"
import {useUserStore} from "./user"
import SessionManager from "@/session/SessionManager"
import {InMemoryStorageAdapter} from "@/session/StorageAdapter"
import {ndk} from "@/utils/ndk"
import {NDKEventFromRawEvent} from "@/utils/nostr"
import {Rumor} from "nostr-double-ratchet/src"

interface PrivateChatsStoreState {
  chats: Map<string, {lastSeen: number}> // userPubKey -> chat metadata
  sessionManager: SessionManager | null
}

interface PrivateChatsStoreActions {
  initializeSessionManager: () => Promise<void>
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

export const usePrivateChatsStore = create<PrivateChatsStore>()((set, get) => ({
  chats: new Map(),
  sessionManager: null,

  initializeSessionManager: async () => {
    const userStore = useUserStore.getState()
    if (!userStore.privateKey || !userStore.publicKey) {
      throw new Error("User not logged in")
    }

    // Generate device ID if not exists
    let deviceId = localStorage.getItem("deviceId")
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem("deviceId", deviceId)
    }

    // Create nostr subscribe and publish functions
    const nostrSubscribe = (filter: Filter, onEvent: (event: VerifiedEvent) => void) => {
      const sub = ndk().subscribe(filter)
      sub.on("event", (e) => onEvent(e as unknown as VerifiedEvent))
      return () => sub.stop()
    }

    const nostrPublish = async (event: any) => {
      const ndkEvent = NDKEventFromRawEvent(event)
      await ndkEvent.publish()
      // Return the event as VerifiedEvent format for SessionManager
      return event as VerifiedEvent
    }

    // Initialize SessionManager
    const sessionManager = new SessionManager(
      hexToBytes(userStore.privateKey),
      deviceId,
      nostrSubscribe,
      nostrPublish,
      new InMemoryStorageAdapter() // TODO: use persistent storage
    )

    // Set up event listener for incoming messages
    sessionManager.onEvent((event: Rumor, fromPubKey: string) => {
      // Convert to MessageType format and add to private messages store
      const messageEvent = {
        ...event,
        pubkey: fromPubKey,
        created_at: event.created_at || Math.floor(Date.now() / 1000),
        id: event.id || crypto.randomUUID(),
        sig: "",
        tags: event.tags || [],
        kind: event.kind || 14, // Default to chat message kind
      }

      usePrivateMessagesStore.getState().upsert(fromPubKey, messageEvent as MessageType)
    })

    await sessionManager.init()
    set({sessionManager})
  },

  sendToUser: async (userPubKey: string, event: Partial<UnsignedEvent>) => {
    const sessionManager = get().sessionManager
    if (!sessionManager) {
      throw new Error("SessionManager not initialized")
    }

    const myPubKey = useUserStore.getState().publicKey

    if (event.content) {
      // Send text message
      await sessionManager.sendText(userPubKey, event.content)
    } else {
      // Send generic event
      await sessionManager.sendEvent(userPubKey, event as Partial<Rumor>)
    }

    // For multi-device sync, also send to self if recipient is not self
    if (userPubKey !== myPubKey) {
      if (event.content) {
        await sessionManager.sendText(myPubKey, event.content)
      } else {
        await sessionManager.sendEvent(myPubKey, event as Partial<Rumor>)
      }
    }

    return userPubKey
  },

  updateLastSeen: (userPubKey: string) => {
    const chats = new Map(get().chats)
    const chat = chats.get(userPubKey) || {lastSeen: 0}
    chat.lastSeen = Date.now()
    chats.set(userPubKey, chat)
    set({chats})
  },

  getChatsList: () => {
    const sessionManager = get().sessionManager
    const chats = get().chats

    if (!sessionManager) {
      return []
    }

    // Get all users we have sessions with
    const userRecords = (sessionManager as any).userRecords as Map<
      string,
      {getActiveSessions(): unknown[]}
    >
    const userPubKeys = new Set<string>()

    for (const [userPubKey, userRecord] of userRecords.entries()) {
      // Only include users with active sessions
      if (userRecord.getActiveSessions().length > 0) {
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
        const unreadCount = Array.from(messages.values()).filter((msg: MessageType) => {
          if (msg.pubkey === myPubKey) return false // Don't count our own messages
          const msgTime = msg.created_at ? msg.created_at * 1000 : 0
          return msgTime > chatData.lastSeen
        }).length

        return {
          userPubKey,
          lastMessage,
          lastMessageTime: lastMessage?.created_at ? lastMessage.created_at * 1000 : 0,
          unreadCount,
        }
      })
      .sort((a, b) => b.lastMessageTime - a.lastMessageTime)
  },
}))

let sessionManagerInitialized = false

// Reset the initialization flag (useful when user changes)
export function resetSessionManagerInitialization() {
  sessionManagerInitialized = false
}

// Helper to initialize SessionManager after user is logged in
export async function initializeSessionManager() {
  const publicKey = useUserStore.getState().publicKey
  console.log("initializeSessionManager", publicKey)

  if (!publicKey) {
    return
  }

  // Prevent multiple initializations
  if (sessionManagerInitialized) {
    console.log("SessionManager already initialized, skipping")
    return
  }

  sessionManagerInitialized = true

  try {
    await usePrivateChatsStore.getState().initializeSessionManager()
    console.log("SessionManager initialized successfully")
  } catch (error) {
    console.error("Failed to initialize SessionManager:", error)
    sessionManagerInitialized = false
  }
}
