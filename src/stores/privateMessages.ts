import {comparator} from "@/pages/chats/utils/messageGrouping"
import type {MessageType} from "@/pages/chats/message/Message"
import * as messageRepository from "@/utils/messageRepository"
import {KIND_REACTION} from "@/utils/constants"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {create} from "zustand"

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
}

interface PrivateMessagesStoreActions {
  upsert: (chatId: string, message: MessageType) => Promise<void>
  updateMessage: (
    chatId: string,
    messageId: string,
    updates: Partial<MessageType>
  ) => Promise<void>
  removeSession: (chatId: string) => Promise<void>
  removeMessage: (chatId: string, messageId: string) => Promise<void>
  clear: () => Promise<void>
}

type PrivateMessagesStore = PrivateMessagesStoreState & PrivateMessagesStoreActions

const makeOrModifyMessage = async (chatId: string, message: MessageType) => {
  const isReaction = message.kind === KIND_REACTION
  const eTag = message.tags.find(([key]) => key === "e")
  if (isReaction && eTag) {
    const [, messageId] = eTag
    // First try to find by the exact ID (for inner message IDs)
    let oldMsg = await messageRepository.getById(messageId)

    // If not found, search through all messages to find by canonical ID
    if (!oldMsg) {
      const state = usePrivateMessagesStore.getState()

      // Search through all chats for a message with matching ID
      for (const [, chatMessages] of state.events.entries()) {
        // Find message with matching ID
        for (const [, msg] of chatMessages.entries()) {
          if (msg.id === messageId) {
            oldMsg = msg
            break
          }
        }
        if (oldMsg) break
      }
    }

    const pubKey = message.pubkey

    if (oldMsg) {
      const updatedMsg = {
        ...oldMsg,
        reactions: {
          ...oldMsg.reactions,
          [pubKey]: message.content,
        },
      }
      // Find which chat this message belongs to
      let messageChatId = null
      for (const [cid, chatMessages] of usePrivateMessagesStore
        .getState()
        .events.entries()) {
        if (chatMessages.has(oldMsg.id)) {
          messageChatId = cid
          break
        }
      }

      if (messageChatId) {
        await messageRepository.save(messageChatId, updatedMsg)
        return updatedMsg
      }
    }
  }
  return message
}

export const usePrivateMessagesStore = create<PrivateMessagesStore>((set) => {
  const rehydration = messageRepository
    .loadAll()
    .then((data) => set({events: data}))
    .catch(console.error)
  return {
    events: new Map(),

    upsert: async (chatId, event) => {
      console.warn("Upsert called for chatId", chatId, event)
      await rehydration
      console.warn("Upserting message", chatId, event)
      const message = await makeOrModifyMessage(chatId, event)
      console.warn("Upserted/modified message", chatId, message)
      await messageRepository.save(chatId, message)
      console.warn("Saved message to repository", chatId, message)
      set((state) => ({
        events: addToMap(new Map(state.events), chatId, message),
      }))
    },

    removeSession: async (chatId) => {
      await rehydration
      await messageRepository.deleteBySession(chatId)
      set((state) => {
        const events = new Map(state.events)
        events.delete(chatId)
        return {events}
      })
    },

    clear: async () => {
      await rehydration
      await messageRepository.clearAll()
      set({events: new Map()})
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
  }
})
