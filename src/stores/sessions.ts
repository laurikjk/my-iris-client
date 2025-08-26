import {
  Session,
  serializeSessionState,
  deserializeSessionState,
} from "nostr-double-ratchet/src"
import {createJSONStorage, persist} from "zustand/middleware"
import type {MessageType} from "@/pages/chats/message/Message"
import {UnsignedEvent} from "nostr-tools"
import {NDKEventFromRawEvent} from "@/utils/nostr"
import {KIND_REACTION} from "@/utils/constants"
import {ndk} from "@/utils/ndk"
import localforage from "localforage"
import {create} from "zustand"
import {getCanonicalId} from "@/utils/getCanonicalId"

// Import stores that we need for event routing
import {usePrivateMessagesStore} from "./privateMessages"
import {useUserStore} from "./user"
import {useGroupsStore} from "./groups"
import {useUserRecordsStore} from "./userRecords"
import {UserRecord} from "./UserRecord"

// Import refactored modules
import {routeEventToStore} from "./sessions/eventRouter"
import {sessionSubscribe} from "./sessions/utils"
import type {SessionData} from "./sessions/types"

// routeEventToStore is now imported from ./sessions/eventRouter

// sessionSubscribe is now imported from ./sessions/utils

// SessionData type is now imported from ./sessions/types

interface SessionsStoreState {
  sessions: Map<string, SessionData> // sessionId -> SessionData
  sessionListeners: Map<string, () => void> // sessionId -> unsubscribe function
  eventCallbacks: Set<(sessionId: string, event: MessageType) => void> // External event callbacks
}

interface SessionsStoreActions {
  // Session management
  addSession: (
    sessionId: string,
    session: Session,
    userPubKey: string,
    deviceId: string
  ) => void
  removeSession: (sessionId: string) => void
  getSession: (sessionId: string) => Session | undefined
  hasSession: (sessionId: string) => boolean

  // Session state updates (triggers individual persistence)

  // Send methods
  sendMessage: (sessionId: string, event: Partial<UnsignedEvent>) => Promise<void>

  // Event listeners (internal - sessions store handles these automatically)
  setSessionListener: (sessionId: string, onEvent: (event: MessageType) => void) => void
  removeSessionListener: (sessionId: string) => void

  // Event callbacks (for external stores to get notified)
  onSessionEvent: (
    callback: (sessionId: string, event: MessageType) => void
  ) => () => void

  // Initialization
  initializeSessionListeners: () => void

  // Utilities
  reset: () => void
}

type SessionsStore = SessionsStoreState & SessionsStoreActions

export const useSessionsStore = create<SessionsStore>()(
  persist(
    (set, get) => {
      return {
        sessions: new Map(),
        sessionListeners: new Map(),
        eventCallbacks: new Set(),

        addSession: (
          sessionId: string,
          session: Session,
          userPubKey: string,
          deviceId: string
        ) => {
          console.log("Adding session:", sessionId)
          const newSessions = new Map(get().sessions)
          newSessions.set(sessionId, {session, userPubKey, deviceId})
          set({sessions: newSessions})

          // Automatically set up event listener for the new session
          get().setSessionListener(sessionId, async (event) => {
            await processSessionEvent(get, sessionId, event)
          })
        },

        removeSession: (sessionId: string) => {
          console.log("Removing session:", sessionId)
          const sessionData = get().sessions.get(sessionId)
          if (sessionData) {
            sessionData.session.close()
          }

          // Remove from sessions
          const newSessions = new Map(get().sessions)
          newSessions.delete(sessionId)

          // Remove listener
          get().removeSessionListener(sessionId)

          set({sessions: newSessions})
        },

        getSession: (sessionId: string) => {
          return get().sessions.get(sessionId)?.session
        },

        hasSession: (sessionId: string) => {
          return get().sessions.has(sessionId)
        },

        sendMessage: async (sessionId: string, event: Partial<UnsignedEvent>) => {
          console.log("sendMessage called for session", sessionId, "event:", event)
          const sessionData = get().sessions.get(sessionId)
          if (!sessionData) {
            throw new Error(`Session not found: ${sessionId}`)
          }
          const session = sessionData.session

          // Debug session state
          console.log("Session state for sending:", {
            sessionId,
            hasTheirNextKey: !!session.state?.theirNextNostrPublicKey,
            hasOurCurrentKey: !!session.state?.ourCurrentNostrKey,
            canSend: !!(
              session.state?.theirNextNostrPublicKey && session.state?.ourCurrentNostrKey
            ),
          })

          // Check if session can send messages
          if (
            !session.state?.theirNextNostrPublicKey ||
            !session.state?.ourCurrentNostrKey
          ) {
            console.error("Session not ready to send messages:", sessionId, {
              theirNextKey: !!session.state?.theirNextNostrPublicKey,
              ourCurrentKey: !!session.state?.ourCurrentNostrKey,
            })
            throw new Error(
              "Session not ready to send messages - missing keys after deserialization"
            )
          }

          if (
            event.kind === KIND_REACTION &&
            !event.tags?.find((tag) => tag[0] === "e")
          ) {
            throw new Error("Cannot send a reaction without a replyingToId")
          }

          const {event: publishedEvent, innerEvent} = session.sendEvent(event)

          // Process innerEvent to show message immediately
          if (innerEvent) {
            try {
              const myPubKey = useUserStore.getState().publicKey

              // Replace id with canonical id for all messages
              // Set pubkey before calculating canonical ID to ensure consistency
              innerEvent.pubkey = myPubKey
              innerEvent.id = await getCanonicalId(innerEvent)

              // Route the message - SortedMap will handle deduplication automatically
              const messageToRoute = {
                ...innerEvent,
                pubkey: myPubKey,
                reactions: {},
                nostrEventId: publishedEvent.id, // Add the outer event ID
              } as MessageType

              // Get the user we're chatting with from session data
              const sessionData = get().sessions.get(sessionId)
              if (sessionData) {
                routeEventToStore(messageToRoute, sessionData.userPubKey, myPubKey)
              }
            } catch (error) {
              console.error("Error processing innerEvent:", error)
            }
          }

          try {
            const e = NDKEventFromRawEvent(publishedEvent)
            // Debug NDK connection status
            const ndkInstance = ndk()
            console.log(
              "NDK connected relays:",
              ndkInstance.pool.connectedRelays().length
            )
            console.log("NDK total relays:", ndkInstance.pool.relays.size)

            await e.publish(undefined, undefined, 0)
            console.log("published", publishedEvent.id)

            // Mark message as sent to relays
            if (innerEvent && innerEvent.id) {
              const sessionData = get().sessions.get(sessionId)
              if (sessionData) {
                // Determine the chat ID based on the message type
                const groupLabelTag = innerEvent.tags?.find(
                  (tag: string[]) => tag[0] === "l"
                )
                const pTag = innerEvent.tags?.find((tag: string[]) => tag[0] === "p")
                const myPubKey = useUserStore.getState().publicKey

                let chatId
                if (groupLabelTag && groupLabelTag[1]) {
                  chatId = groupLabelTag[1]
                } else if (innerEvent.pubkey === myPubKey) {
                  chatId = pTag?.[1] || sessionData.userPubKey
                } else {
                  chatId = sessionData.userPubKey
                }

                // Update the message with sentToRelays flag and nostrEventId
                await usePrivateMessagesStore
                  .getState()
                  .updateMessage(chatId, innerEvent.id, {
                    sentToRelays: true,
                    nostrEventId: publishedEvent.id,
                  })
              }
            }
          } catch (err) {
            console.warn("Error publishing event:", err)
          }
        },

        setSessionListener: (
          sessionId: string,
          onEvent: (event: MessageType) => void
        ) => {
          const sessionData = get().sessions.get(sessionId)
          if (!sessionData) {
            console.warn("Cannot set listener for non-existent session:", sessionId)
            return
          }
          const session = sessionData.session

          // Remove existing listener if any
          get().removeSessionListener(sessionId)

          // Set up new listener
          const unsubscribe = session.onEvent(async (event) => {
            // Just pass to the onEvent callback - canonical ID will be handled by processSessionEvent
            onEvent(event)
          })

          const newListeners = new Map(get().sessionListeners)
          newListeners.set(sessionId, unsubscribe)
          set({sessionListeners: newListeners})
        },

        removeSessionListener: (sessionId: string) => {
          const unsubscribe = get().sessionListeners.get(sessionId)
          if (unsubscribe) {
            unsubscribe()
            const newListeners = new Map(get().sessionListeners)
            newListeners.delete(sessionId)
            set({sessionListeners: newListeners})
          }
        },

        onSessionEvent: (callback: (sessionId: string, event: MessageType) => void) => {
          const callbacks = new Set(get().eventCallbacks)
          callbacks.add(callback)
          set({eventCallbacks: callbacks})

          // Return unsubscribe function
          return () => {
            const newCallbacks = new Set(get().eventCallbacks)
            newCallbacks.delete(callback)
            set({eventCallbacks: newCallbacks})
          }
        },

        initializeSessionListeners: () => {
          console.log("Initializing session listeners for all deserialized sessions...")
          const sessions = get().sessions
          let count = 0

          // Small delay to ensure sessions are fully reconstructed
          setTimeout(() => {
            for (const [sessionId, sessionData] of sessions.entries()) {
              const session = sessionData.session
              if (!get().sessionListeners.has(sessionId)) {
                console.log("Setting up listener for deserialized session:", sessionId)

                // Debug session state after deserialization
                console.log("Deserialized session state:", {
                  sessionId,
                  hasTheirNextKey: !!session.state?.theirNextNostrPublicKey,
                  hasOurCurrentKey: !!session.state?.ourCurrentNostrKey,
                  canSend: !!(
                    session.state?.theirNextNostrPublicKey &&
                    session.state?.ourCurrentNostrKey
                  ),
                })

                // Set up listener that calls the provided onEvent callback
                get().setSessionListener(sessionId, async (event) => {
                  await processSessionEvent(get, sessionId, event)
                })
                count++
              }
            }

            console.log(
              `Initialized ${count} session listeners for deserialized sessions`
            )
          }, 100)
        },

        reset: () => {
          console.log("Resetting sessions store...")

          // Close all sessions
          for (const sessionData of get().sessions.values()) {
            sessionData.session.close()
          }

          // Remove all listeners
          for (const unsubscribe of get().sessionListeners.values()) {
            unsubscribe()
          }

          set({
            sessions: new Map(),
            sessionListeners: new Map(),
            eventCallbacks: new Set(),
          })

          console.log("Sessions store reset completed.")
        },
      }
    },
    {
      name: "sessions",
      storage: createJSONStorage(() => localforage),
      partialize: (state: SessionsStore) => ({
        // Only serialize sessions, not listeners (they'll be recreated)
        sessions: Array.from(state.sessions.entries()).map(([sessionId, sessionData]) => [
          sessionId,
          {
            state: serializeSessionState(sessionData.session.state),
            userPubKey: sessionData.userPubKey,
            deviceId: sessionData.deviceId,
          },
        ]),
      }),
      merge: (persistedState: unknown, currentState: SessionsStore) => {
        const state = (persistedState || {sessions: []}) as {
          sessions: [string, {state: string; userPubKey: string; deviceId: string}][]
        }

        const newSessions = new Map<string, SessionData>()
        state.sessions?.forEach(([sessionId, data]) => {
          try {
            const sessionState = deserializeSessionState(data.state)
            const session = new Session(sessionSubscribe, sessionState)
            newSessions.set(sessionId, {
              session,
              userPubKey: data.userPubKey,
              deviceId: data.deviceId,
            })
            console.log("Successfully deserialized session:", sessionId)
          } catch (e) {
            console.warn("Failed to deserialize session:", sessionId, e)
            // Individual session failures don't affect others
          }
        })

        return {
          ...currentState,
          sessions: newSessions,
          sessionListeners: new Map(), // Will be recreated in onRehydrateStorage
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log("Sessions store rehydrated, wiring listeners for hydrated sessions")
          setTimeout(() => {
            state.initializeSessionListeners()
          }, 50)
        }
      },
    }
  )
)

// Unified session event handler that processes all events
const processSessionEvent = async (
  get: () => SessionsStore,
  sessionId: string,
  event: MessageType
) => {
  console.log("=== PROCESS SESSION EVENT ===")
  console.log("SessionId:", sessionId)
  console.log("Event kind:", event.kind)
  console.log("Event content preview:", event.content?.substring(0, 50))

  // Get session data
  const sessionData = get().sessions.get(sessionId)
  if (!sessionData) {
    console.warn("Session data not found for event processing:", sessionId)
    return
  }

  console.log("Session user:", sessionData.userPubKey)
  console.log("Session device:", sessionData.deviceId)

  // Set pubkey before calculating canonical ID to ensure consistency
  event.pubkey = sessionData.userPubKey

  // Replace id with canonical id immediately for all messages
  try {
    event.id = await getCanonicalId(event)
  } catch (error) {
    console.error("Error calculating canonical ID:", error)
  }

  // Now handle the event
  await handleSessionEvent(get, sessionId, event)

  // Trigger persistence for this session - force Zustand persistence by recreating the sessions Map
  const store = useSessionsStore.getState()
  const newSessions = new Map(store.sessions)
  useSessionsStore.setState({sessions: newSessions})
}

// Helper to process any session event consistently
const handleSessionEvent = async (
  get: () => SessionsStore,
  sessionId: string,
  event: MessageType
) => {
  // Route to events store
  // Get userPubKey from session data
  const sessionData = get().sessions.get(sessionId)
  if (!sessionData) {
    console.warn("Session data not found for event routing:", sessionId)
    return
  }

  console.log(
    "handleSessionEvent called for session",
    sessionId,
    "event ID:",
    event.id,
    "kind:",
    event.kind
  )

  // Handle group creation event (kind 40)
  if (event.kind === 40 && event.content) {
    try {
      const group = JSON.parse(event.content)
      const groups = useGroupsStore.getState().groups
      if (!groups[group.id]) {
        useGroupsStore.getState().addGroup(group)
      }
    } catch (e) {
      console.warn("Failed to parse group from kind 40 event", e)
    }
  }

  // Fallback: if message has an "l" tag (group id) ensure group exists
  const groupLabel = event.tags?.find((t) => t[0] === "l")?.[1]
  if (groupLabel) {
    const groupsStore = useGroupsStore.getState()
    const existingGroup = groupsStore.groups[groupLabel]

    if (!existingGroup) {
      // Create group with sender as initial member
      groupsStore.addGroup({
        id: groupLabel,
        name: groupLabel, // placeholder
        description: "",
        picture: "",
        members: [sessionData.userPubKey], // Add sender as member
        createdAt: Date.now(),
      })
      console.log(
        "Created new group with sender as member:",
        groupLabel,
        sessionData.userPubKey
      )
    } else {
      // Add sender to existing group if not already a member
      if (!existingGroup.members.includes(sessionData.userPubKey)) {
        groupsStore.addMember(groupLabel, sessionData.userPubKey)
        console.log("Added sender to existing group:", groupLabel, sessionData.userPubKey)
      }
    }
  }

  const ourPubKey = useUserStore.getState().publicKey
  console.log("Routing event - ourPubKey:", ourPubKey)
  console.log("Routing event - sessionData.userPubKey:", sessionData.userPubKey)
  console.log("Routing event - message pubkey:", event.pubkey)

  // If this message is from our own other device, mark it as sent to relays
  if (sessionData.userPubKey === ourPubKey && event.pubkey === ourPubKey) {
    console.log("Message from our own device, marking as sentToRelays")
    event.sentToRelays = true
  }

  routeEventToStore(event, sessionData.userPubKey, ourPubKey)

  // --- Ensure UserRecord exists and session is referenced ---
  const {userPubKey, deviceId} = sessionData
  const urStore = useUserRecordsStore.getState()
  if (!urStore.userRecords.has(userPubKey)) {
    const newRecord = new UserRecord(userPubKey, userPubKey)
    const map = new Map(urStore.userRecords)
    map.set(userPubKey, newRecord)
    useUserRecordsStore.setState({userRecords: map})
  }

  // Ensure sessionId is linked to this user/device
  const me = useUserStore.getState().publicKey
  const myDeviceId = useUserRecordsStore.getState().deviceId
  if (!(userPubKey === me && deviceId === myDeviceId)) {
    const rec = useUserRecordsStore.getState().userRecords.get(userPubKey)!
    if (rec && !rec.getActiveSessionId(deviceId)) {
      rec.upsertSession(deviceId, sessionId)
      // trigger persistence
      useUserRecordsStore.setState({
        userRecords: new Map(useUserRecordsStore.getState().userRecords),
      })
    }
  }

  // Notify external callbacks
  for (const cb of get().eventCallbacks) {
    try {
      cb(sessionId, event)
    } catch (err) {
      console.warn("Error in session event callback", err)
    }
  }
}
