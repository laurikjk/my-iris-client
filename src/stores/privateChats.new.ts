import {createJSONStorage, persist} from "zustand/middleware"
import {MessageType} from "@/pages/chats/message/Message"
import {comparator} from "@/pages/chats/utils/messageGrouping"
import * as messageRepository from "@/utils/messageRepository"
import {KIND_REACTION} from "@/utils/constants"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import SessionManager from "./SessionManager"
import {StorageAdapter} from "./StorageAdapter"
import {UserRecord} from "./UserRecord"
import localforage from "localforage"
import {create} from "zustand"
import {UnsignedEvent, generateSecretKey} from "nostr-tools"
import {useUserStore} from "./user"
import {ndk} from "@/utils/ndk"

// Subscribe function for nostr events
const subscribe = (filter: unknown, onEvent: (event: unknown) => void) => {
  const sub = ndk().subscribe(filter)
  sub.on("event", (e: unknown) => onEvent(e))
  return () => sub.stop()
}

// Publish function for nostr events
const publish = async (event: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ndkEvent = new (ndk() as any).Event(event)
  return await ndkEvent.publish()
}

const addToMap = (
  chatEventMap: Map<string, SortedMap<string, MessageType>>,
  chatId: string,
  message: MessageType
) => {
  const eventMap =
    chatEventMap.get(chatId) || new SortedMap<string, MessageType>([], comparator)

  eventMap.set(message.id, message)
  chatEventMap.set(chatId, eventMap)
  return chatEventMap
}

const makeOrModifyMessage = async (chatId: string, message: MessageType) => {
  const isReaction = message.kind === KIND_REACTION
  const eTag = message.tags.find(([key]) => key === "e")
  if (isReaction && eTag) {
    const [, messageId] = eTag
    // First try to find by the exact ID (for inner message IDs)
    let oldMsg = await messageRepository.getById(messageId)

    // If not found, search through all messages to find by canonical ID
    if (!oldMsg) {
      const state = usePrivateChatsStoreNew.getState()
      for (const [, eventMap] of state.messages.entries()) {
        const found = eventMap.values().find((msg) => msg.id === messageId)
        if (found) {
          oldMsg = found
          break
        }
      }
    }

    if (oldMsg) {
      const reactions = oldMsg.reactions || {}
      const content = message.content || "+"
      if (!reactions[content]) {
        reactions[content] = []
      }
      if (!reactions[content].some((r) => r.pubkey === message.pubkey)) {
        reactions[content].push({
          pubkey: message.pubkey,
          created_at: message.created_at,
        })
      }
      const updatedMsg = {...oldMsg, reactions}
      await messageRepository.upsert(updatedMsg)
      return updatedMsg
    }
  }

  await messageRepository.upsert(message)
  return message
}

interface PrivateChatsStoreState {
  // Message storage
  messages: Map<string, SortedMap<string, MessageType>> // chatId -> messages

  // Chat metadata
  chats: Map<string, {lastSeen: number}> // userPubKey -> chat metadata

  // Session management
  sessionManager?: SessionManager
  userRecords: Map<string, UserRecord> // userPubKey -> UserRecord

  // Initialization state
  isInitialized: boolean
}

interface PrivateChatsStoreActions {
  // Initialization
  initialize: () => Promise<void>

  // Message operations
  upsertMessage: (chatId: string, message: MessageType) => Promise<void>
  updateMessage: (
    chatId: string,
    messageId: string,
    updates: Partial<MessageType>
  ) => Promise<void>
  removeMessage: (chatId: string, messageId: string) => Promise<void>

  // Chat operations
  sendToUser: (userPubKey: string, event: Partial<UnsignedEvent>) => Promise<string>
  updateLastSeen: (userPubKey: string) => void
  getChatsList: () => Array<{
    userPubKey: string
    lastMessage?: MessageType
    lastMessageTime: number
    unreadCount: number
  }>

  // Session management
  startListeningToUser: (userPubKey: string) => void

  // Cleanup
  removeSession: (chatId: string) => Promise<void>
  clear: () => Promise<void>
  reset: () => void
}

type PrivateChatsStoreNew = PrivateChatsStoreState & PrivateChatsStoreActions

export const usePrivateChatsStoreNew = create<PrivateChatsStoreNew>()(
  persist(
    (set, get) => ({
      // Initial state
      messages: new Map(),
      chats: new Map(),
      sessionManager: undefined,
      userRecords: new Map(),
      isInitialized: false,

      // Initialize the store and SessionManager
      initialize: async () => {
        if (get().isInitialized) return

        const userState = useUserStore.getState()
        if (!userState.privateKey) {
          console.log("No private key available - skipping private chat initialization")
          return
        }

        try {
          // Generate or get identity key (in a real app, this should be persistent)
          const identityKey = generateSecretKey()
          const deviceId = crypto.randomUUID()

          // Create session manager with custom storage adapter
          const storage: StorageAdapter = {
            get: async <T>(key: string): Promise<T | undefined> => {
              return (await localforage.getItem(key)) as T | undefined
            },
            put: async <T>(key: string, value: T): Promise<void> => {
              await localforage.setItem(key, value)
            },
            list: async (prefix: string): Promise<string[]> => {
              const keys = await localforage.keys()
              return keys.filter((key) => key.startsWith(prefix))
            },
          }

          const sessionManager = new SessionManager(
            identityKey,
            deviceId,
            subscribe,
            publish,
            storage
          )

          // Set up event listener for incoming messages
          sessionManager.onEvent((event, fromUserPubKey) => {
            const message: MessageType = {
              ...event,
              pubkey: fromUserPubKey,
              reactions: {},
            } as MessageType

            // Route message to appropriate chat
            get().upsertMessage(fromUserPubKey, message)
          })

          set({sessionManager, isInitialized: true})

          console.log("Private chats store initialized successfully")
        } catch (error) {
          console.error("Failed to initialize private chats store:", error)
        }
      },

      // Message operations
      upsertMessage: async (chatId: string, message: MessageType) => {
        try {
          const processedMessage = await makeOrModifyMessage(chatId, message)

          set((state) => ({
            messages: addToMap(new Map(state.messages), chatId, processedMessage),
          }))
        } catch (error) {
          console.error("Error upserting message:", error)
        }
      },

      updateMessage: async (
        chatId: string,
        messageId: string,
        updates: Partial<MessageType>
      ) => {
        set((state) => {
          const newMessages = new Map(state.messages)
          const eventMap = newMessages.get(chatId)
          if (eventMap) {
            const message = eventMap.get(messageId)
            if (message) {
              const updatedMessage = {...message, ...updates}
              eventMap.set(messageId, updatedMessage)
              messageRepository.upsert(updatedMessage).catch(console.error)
            }
          }
          return {messages: newMessages}
        })
      },

      removeMessage: async (chatId: string, messageId: string) => {
        set((state) => {
          const newMessages = new Map(state.messages)
          const eventMap = newMessages.get(chatId)
          if (eventMap) {
            eventMap.delete(messageId)
          }
          return {messages: newMessages}
        })

        try {
          await messageRepository.delete(messageId)
        } catch (error) {
          console.error("Error removing message from repository:", error)
        }
      },

      // Chat operations
      sendToUser: async (userPubKey: string, event: Partial<UnsignedEvent>) => {
        const sessionManager = get().sessionManager
        if (!sessionManager) {
          throw new Error("SessionManager not initialized")
        }

        const myPubKey = useUserStore.getState().publicKey
        if (!myPubKey) {
          throw new Error("No public key available")
        }

        // Add required tags
        const eventWithTags = {
          ...event,
          created_at: event.created_at || Math.round(Date.now() / 1000),
          tags: event.tags || [],
        }

        // Ensure p tag exists
        if (!eventWithTags.tags.some((tag) => tag[0] === "p")) {
          eventWithTags.tags.push(["p", userPubKey])
        }

        // Send via SessionManager
        await sessionManager.sendEvent(userPubKey, eventWithTags)

        // Update chat metadata
        set((state) => {
          const newChats = new Map(state.chats)
          if (!newChats.has(userPubKey)) {
            newChats.set(userPubKey, {lastSeen: Date.now()})
          }
          return {chats: newChats}
        })

        return userPubKey
      },

      updateLastSeen: (userPubKey: string) => {
        set((state) => {
          const newChats = new Map(state.chats)
          const existingChat = newChats.get(userPubKey)
          newChats.set(userPubKey, {
            ...existingChat,
            lastSeen: Date.now(),
          })
          return {chats: newChats}
        })
      },

      getChatsList: () => {
        const state = get()
        const myPubKey = useUserStore.getState().publicKey
        const chatsList: Array<{
          userPubKey: string
          lastMessage?: MessageType
          lastMessageTime: number
          unreadCount: number
        }> = []

        // Combine chats from messages and chat metadata
        const allChatIds = new Set([...state.messages.keys(), ...state.chats.keys()])

        for (const userPubKey of allChatIds) {
          const messages = state.messages.get(userPubKey)
          const chatMeta = state.chats.get(userPubKey)
          const lastSeen = chatMeta?.lastSeen || 0

          const messagesArray = messages ? messages.values() : []
          const lastMessage = messagesArray[messagesArray.length - 1]
          const lastMessageTime = lastMessage ? lastMessage.created_at * 1000 : 0

          // Count unread messages (messages after lastSeen)
          const unreadCount = messagesArray.filter(
            (msg) => msg.created_at * 1000 > lastSeen && msg.pubkey !== myPubKey
          ).length

          chatsList.push({
            userPubKey,
            lastMessage,
            lastMessageTime,
            unreadCount,
          })
        }

        // Sort by last message time
        return chatsList.sort((a, b) => b.lastMessageTime - a.lastMessageTime)
      },

      // Session management
      startListeningToUser: (userPubKey: string) => {
        const sessionManager = get().sessionManager
        if (sessionManager) {
          sessionManager.listenToUser(userPubKey)
        }
      },

      // Cleanup operations
      removeSession: async (chatId: string) => {
        set((state) => {
          const newMessages = new Map(state.messages)
          newMessages.delete(chatId)

          const newChats = new Map(state.chats)
          newChats.delete(chatId)

          return {messages: newMessages, chats: newChats}
        })
      },

      clear: async () => {
        set({
          messages: new Map(),
          chats: new Map(),
        })

        try {
          await messageRepository.clear()
        } catch (error) {
          console.error("Error clearing message repository:", error)
        }
      },

      reset: () => {
        const sessionManager = get().sessionManager
        if (sessionManager) {
          sessionManager.close()
        }

        set({
          messages: new Map(),
          chats: new Map(),
          sessionManager: undefined,
          userRecords: new Map(),
          isInitialized: false,
        })
      },
    }),
    {
      name: "private-chats-new",
      storage: createJSONStorage(() => localforage),
      partialize: (state: PrivateChatsStoreNew) => ({
        // Only persist chats metadata and messages
        // SessionManager and UserRecord have their own persistence
        chats: Array.from(state.chats.entries()),
        messages: Array.from(state.messages.entries()).map(([chatId, eventMap]) => [
          chatId,
          eventMap.entries(),
        ]),
      }),
      merge: (persistedState: unknown, currentState: PrivateChatsStoreNew) => {
        const state = persistedState as {
          chats: [string, {lastSeen: number}][]
          messages: [string, [string, MessageType][]][]
        }

        const restoredChats = new Map(state.chats || [])
        const restoredMessages = new Map<string, SortedMap<string, MessageType>>()

        if (state.messages) {
          for (const [chatId, messageEntries] of state.messages) {
            const eventMap = new SortedMap<string, MessageType>([], comparator)
            for (const [messageId, message] of messageEntries) {
              eventMap.set(messageId, message)
            }
            restoredMessages.set(chatId, eventMap)
          }
        }

        return {
          ...currentState,
          chats: restoredChats,
          messages: restoredMessages,
        }
      },
      onRehydrateStorage: () => (state) => {
        // Initialize the store after rehydration
        if (state) {
          setTimeout(() => {
            state.initialize()
          }, 100)
        }
      },
    }
  )
)
