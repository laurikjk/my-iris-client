import {comparator} from "@/pages/chats/utils/messageGrouping"
import type {MessageType} from "@/pages/chats/message/Message"
import * as messageRepository from "@/utils/messageRepository"
import {KIND_REACTION} from "@/utils/constants"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {create} from "zustand"

const addToMap = (
  sessionEventMap: Map<string, SortedMap<string, MessageType>>,
  sessionId: string,
  message: MessageType
) => {
  const eventMap =
    sessionEventMap.get(sessionId) || new SortedMap<string, MessageType>([], comparator)
  eventMap.set(message.id, message)
  sessionEventMap.set(sessionId, eventMap)
  return sessionEventMap
}

interface EventsStoreState {
  events: Map<string, SortedMap<string, MessageType>>
}

interface EventsStoreActions {
  upsert: (sessionId: string, message: MessageType) => Promise<void>
  updateMessage: (
    sessionId: string,
    messageId: string,
    updates: Partial<MessageType>
  ) => Promise<void>
  removeSession: (sessionId: string) => Promise<void>
  removeMessage: (sessionId: string, messageId: string) => Promise<void>
  clear: () => Promise<void>
}

type EventsStore = EventsStoreState & EventsStoreActions

const makeOrModifyMessage = async (sessionId: string, message: MessageType) => {
  const isReaction = message.kind === KIND_REACTION
  const eTag = message.tags.find(([key]) => key === "e")
  if (isReaction && eTag) {
    const [, messageId] = eTag
    // First try to find by the exact ID (for inner message IDs)
    let oldMsg = await messageRepository.getById(messageId)

    // If not found, search through all messages to find by canonical ID
    if (!oldMsg) {
      const state = useEventsStore.getState()

      // Search through all sessions for a message with matching canonical ID
      for (const [, sessionMessages] of state.events.entries()) {
        // Find message with matching canonical ID
        for (const [, msg] of sessionMessages.entries()) {
          if (msg.canonicalId === messageId || msg.id === messageId) {
            oldMsg = msg
            break
          }
        }
        if (oldMsg) break
      }
    }

    const pubKey = message.pubkey || sessionId.split(":")[0]

    if (oldMsg) {
      const updatedMsg = {
        ...oldMsg,
        reactions: {
          ...oldMsg.reactions,
          [pubKey]: message.content,
        },
      }
      // Find which session this message belongs to
      let targetSessionId = null
      for (const [tid, sessionMessages] of useEventsStore.getState().events.entries()) {
        if (sessionMessages.has(oldMsg.id)) {
          targetSessionId = tid
          break
        }
      }

      if (targetSessionId) {
        await messageRepository.save(targetSessionId, updatedMsg)
        return updatedMsg
      }
    }
  }
  return message
}

export const useEventsStore = create<EventsStore>((set) => {
  const rehydration = messageRepository
    .loadAll()
    .then((data) => set({events: data}))
    .catch(console.error)
  return {
    events: new Map(),

    upsert: async (sessionId, event) => {
      await rehydration
      const message = await makeOrModifyMessage(sessionId, event)
      await messageRepository.save(sessionId, message)
      set((state) => ({
        events: addToMap(new Map(state.events), sessionId, message),
      }))
    },

    removeSession: async (sessionId) => {
      await rehydration
      await messageRepository.deleteBySession(sessionId)
      set((state) => {
        const events = new Map(state.events)
        events.delete(sessionId)
        return {events}
      })
    },

    clear: async () => {
      await rehydration
      await messageRepository.clearAll()
      set({events: new Map()})
    },

    updateMessage: async (
      sessionId: string,
      messageId: string,
      updates: Partial<MessageType>
    ) => {
      await rehydration
      set((state) => {
        const events = new Map(state.events)
        const eventMap = events.get(sessionId)
        if (eventMap) {
          const existingMessage = eventMap.get(messageId)
          if (existingMessage) {
            const updatedMessage = {...existingMessage, ...updates}
            eventMap.set(messageId, updatedMessage)
            messageRepository.save(sessionId, updatedMessage)
          }
        }
        return {events}
      })
    },

    removeMessage: async (sessionId: string, messageId: string) => {
      await rehydration
      await messageRepository.deleteMessage(sessionId, messageId)
      set((state) => {
        const events = new Map(state.events)
        const eventMap = events.get(sessionId)
        if (eventMap) {
          eventMap.delete(messageId)
          if (eventMap.size === 0) {
            events.delete(sessionId)
          } else {
            events.set(sessionId, eventMap)
          }
        }
        return {events}
      })
    },
  }
})
