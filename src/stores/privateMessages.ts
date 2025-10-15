import {comparator} from "@/pages/chats/utils/messageGrouping"
import type {MessageType} from "@/pages/chats/message/Message"
import * as messageRepository from "@/utils/messageRepository"
import {KIND_REACTION} from "@/utils/constants"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {create} from "zustand"
import {useUserStore} from "./user"

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

interface PrivateMessagesStoreState {
  events: Map<string, SortedMap<string, MessageType>>
  lastSeen: Map<string, number>
}

interface PrivateMessagesStoreActions {
  upsert: (from: string, to: string, message: MessageType) => Promise<void>
  updateMessage: (
    chatId: string,
    messageId: string,
    updates: Partial<MessageType>
  ) => Promise<void>
  updateLastSeen: (chatId: string, timestamp?: number) => void
  removeSession: (chatId: string) => Promise<void>
  removeMessage: (chatId: string, messageId: string) => Promise<void>
  clear: () => Promise<void>
}

type PrivateMessagesStore = PrivateMessagesStoreState & PrivateMessagesStoreActions

export const usePrivateMessagesStore = create<PrivateMessagesStore>((set) => {
  const rehydration = Promise.all([
    messageRepository.loadAll(),
    messageRepository.loadLastSeen(),
  ])
    .then(([events, lastSeen]) => set({events, lastSeen}))
    .catch(console.error)
  return {
    events: new Map(),
    lastSeen: new Map(),

    upsert: async (from, to, event) => {
      const myPubKey = useUserStore.getState().publicKey
      const chatId = from === myPubKey ? to : from

      // Process reactions synchronously using current state
      let processedMessage: MessageType = event
      set((state) => {
        const isReaction = event.kind === KIND_REACTION
        const eTag = event.tags.find(([key]) => key === "e")

        if (isReaction && eTag) {
          const [, messageId] = eTag
          const pubKey = event.pubkey

          // Find target message in current state
          for (const messageMap of state.events.values()) {
            const oldMsg = messageMap.get(messageId)
            if (oldMsg) {
              processedMessage = {
                ...oldMsg,
                reactions: {
                  ...oldMsg.reactions,
                  [pubKey]: event.content,
                },
              }
              break
            }
          }
        }

        return {
          events: addToMap(new Map(state.events), chatId, processedMessage),
        }
      })

      // Handle persistence in background
      rehydration
        .then(() => messageRepository.save(chatId, processedMessage))
        .catch(console.error)
    },

    removeSession: async (chatId) => {
      await rehydration
      await messageRepository.deleteBySession(chatId)
      await messageRepository.deleteLastSeen(chatId)
      set((state) => {
        const events = new Map(state.events)
        events.delete(chatId)
        const lastSeen = new Map(state.lastSeen)
        lastSeen.delete(chatId)
        return {events, lastSeen}
      })
    },

    clear: async () => {
      await rehydration
      await messageRepository.clearAll()
      await messageRepository.clearLastSeen()
      set({events: new Map(), lastSeen: new Map()})
    },

    updateMessage: async (
      chatId: string,
      messageId: string,
      updates: Partial<MessageType>
    ) => {
      await rehydration
      set((state) => {
        const events = new Map(state.events)
        const eventMap = events.get(chatId)
        if (eventMap) {
          const existingMessage = eventMap.get(messageId)
          if (existingMessage) {
            const updatedMessage = {...existingMessage, ...updates}
            eventMap.set(messageId, updatedMessage)
            messageRepository.save(chatId, updatedMessage)
          }
        }
        return {events}
      })
    },

    removeMessage: async (chatId: string, messageId: string) => {
      await rehydration
      await messageRepository.deleteMessage(chatId, messageId)
      set((state) => {
        const events = new Map(state.events)
        const eventMap = events.get(chatId)
        if (eventMap) {
          eventMap.delete(messageId)
          if (eventMap.size === 0) {
            events.delete(chatId)
          } else {
            events.set(chatId, eventMap)
          }
        }
        return {events}
      })
    },

    updateLastSeen: (chatId: string, timestamp?: number) => {
      const effectiveTimestamp = typeof timestamp === "number" ? timestamp : Date.now()
      set((state) => {
        const lastSeen = new Map(state.lastSeen)
        lastSeen.set(chatId, effectiveTimestamp)
        return {lastSeen}
      })
      messageRepository.saveLastSeen(chatId, effectiveTimestamp).catch(console.error)
    },
  }
})
