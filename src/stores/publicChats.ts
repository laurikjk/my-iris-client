import {fetchChannelMetadata, ChannelMetadata} from "@/pages/chats/utils/channelMetadata"
import {createJSONStorage, persist} from "zustand/middleware"
import localforage from "localforage"
import {create} from "zustand"

export interface PublicChat {
  id: string
  name: string
  about: string
  picture: string
  lastMessage?: string
  lastMessageAt?: number
  metadata?: ChannelMetadata
}

interface PublicChatStore {
  publicChats: Map<string, PublicChat>
  lastSeen: Map<string, number>
  timestamps: Map<string, number>

  updateLastSeen: (chatId: string) => void
  updateTimestamp: (chatId: string, timestamp: number) => void
  refreshChatMetadata: (chatId: string) => Promise<void>
  addPublicChat: (chat: PublicChat) => void
  addPublicChatById: (chatId: string) => Promise<void>
  removePublicChat: (chatId: string) => void
}

const store = create<PublicChatStore>()(
  persist(
    (set, get) => ({
      publicChats: new Map(),
      lastSeen: new Map(),
      timestamps: new Map(),

      updateLastSeen: (chatId: string) => {
        const newLastSeen = new Map(get().lastSeen)
        newLastSeen.set(chatId, Date.now())
        set({lastSeen: newLastSeen})
      },

      updateTimestamp: (chatId: string, timestamp: number) => {
        const newTimestamps = new Map(get().timestamps)
        newTimestamps.set(chatId, timestamp)
        set({timestamps: newTimestamps})
      },

      refreshChatMetadata: async (chatId: string) => {
        try {
          const metadata = await fetchChannelMetadata(chatId)
          const currentChats = get().publicChats
          const existingChat = currentChats.get(chatId)

          if (existingChat && metadata) {
            const updatedChat = {
              ...existingChat,
              metadata,
              name: metadata.name || existingChat.name,
              about: metadata.about || existingChat.about,
              picture: metadata.picture || existingChat.picture,
            }

            const newPublicChats = new Map(currentChats)
            newPublicChats.set(chatId, updatedChat)
            set({publicChats: newPublicChats})
          }
        } catch (err) {
          console.error("Error refreshing chat metadata:", err)
        }
      },

      addPublicChat: (chat: PublicChat) => {
        const newPublicChats = new Map(get().publicChats)
        newPublicChats.set(chat.id, chat)
        set({publicChats: newPublicChats})
      },

      addPublicChatById: async (chatId: string) => {
        const metadata = await fetchChannelMetadata(chatId)

        const chat: PublicChat = {
          id: chatId,
          name: metadata?.name || `Channel ${chatId.slice(0, 8)}...`,
          about: metadata?.about || "",
          picture: metadata?.picture || "",
          ...(metadata ? {metadata} : {}),
        }

        get().addPublicChat(chat)
      },

      removePublicChat: (chatId: string) => {
        const newPublicChats = new Map(get().publicChats)
        const newLastSeen = new Map(get().lastSeen)
        const newTimestamps = new Map(get().timestamps)

        newPublicChats.delete(chatId)
        newLastSeen.delete(chatId)
        newTimestamps.delete(chatId)

        set({
          publicChats: newPublicChats,
          lastSeen: newLastSeen,
          timestamps: newTimestamps,
        })
      },
    }),
    {
      name: "publicChats",
      storage: createJSONStorage(() => localforage),
      partialize: (state) => ({
        publicChats: Array.from(state.publicChats.entries()),
        lastSeen: Array.from(state.lastSeen.entries()),
        timestamps: Array.from(state.timestamps.entries()),
      }),
      merge: (persistedState: unknown, currentState: PublicChatStore) => {
        const state = (persistedState || {
          publicChats: [],
          lastSeen: [],
          timestamps: [],
        }) as {
          publicChats: [string, PublicChat][]
          lastSeen: [string, number][]
          timestamps: [string, number][]
        }

        return {
          ...currentState,
          publicChats: new Map(state.publicChats || []),
          lastSeen: new Map(state.lastSeen || []),
          timestamps: new Map(state.timestamps || []),
        }
      },
    }
  )
)

export const usePublicChatsStore = store
