import {
  Invite,
  Session,
  serializeSessionState,
  deserializeSessionState,
} from "nostr-double-ratchet/src"
import {createJSONStorage, persist, PersistStorage} from "zustand/middleware"
import {Filter, VerifiedEvent, UnsignedEvent} from "nostr-tools"
import {NDKEventFromRawEvent, RawEvent} from "@/utils/nostr"
import {REACTION_KIND} from "@/pages/chats/utils/constants"
import type {MessageType} from "@/pages/chats/message/Message"
import {hexToBytes} from "@noble/hashes/utils"
import {useEventsStore} from "./events"
import localforage from "localforage"
import {useUserStore} from "./user"
import {ndk} from "@/utils/ndk"
import {create} from "zustand"
import {useGroupsStore} from "./groups"
import {usePrivateChatsStore} from "./privateChats"

// Changing storage engine doesn't trigger migration. Only version difference in storage does.
// Here's an utility function that works around it by setting a dummy entry with version 0.
// Simplified version of the code here:
// https://github.com/pmndrs/zustand/discussions/1717#discussioncomment-9355154
const forceMigrationOnInitialPersist = <S>(
  originalStorage: PersistStorage<S> | undefined,
  initialState: S
): PersistStorage<S> | undefined =>
  originalStorage === undefined
    ? originalStorage
    : {
        ...originalStorage,
        getItem: async (name) => {
          const item = await originalStorage.getItem(name)
          return item ?? {state: initialState, version: 0}
        },
      }

// Generate a persistent device ID
const generateDeviceId = (): string => {
  return crypto.randomUUID()
}

interface SessionStoreState {
  invites: Map<string, Invite>
  sessions: Map<string, Session>
  lastSeen: Map<string, number>
  deviceId: string
  userDevices: Map<string, Set<string>> // userPubKey -> Set of deviceIds
  deviceInviteListeners: Map<string, () => void> // userPubKey -> unsubscribe function
  messageQueue: Map<
    string,
    Array<{event: Partial<UnsignedEvent>; resolve: (sessionId: string) => void}>
  >
}

const createSessionWithLastSeen = (
  currentSessions: Map<string, Session>,
  currentLastSeen: Map<string, number>,
  sessionId: string,
  session: Session
) => {
  const newSessions = new Map(currentSessions)
  newSessions.set(sessionId, session)
  const newLastSeen = new Map(currentLastSeen)
  newLastSeen.set(sessionId, Date.now())
  return {sessions: newSessions, lastSeen: newLastSeen}
}

const inviteListeners = new Map<string, () => void>()
const sessionListeners = new Map<string, () => void>()
const pendingInvites = new Set<string>() // Track pending invite acceptances

interface SessionStoreActions {
  createInvite: (label: string, inviteId?: string) => void
  createDefaultInvites: () => void
  acceptInvite: (url: string) => Promise<string>
  sendMessage: (id: string, event: Partial<UnsignedEvent>) => Promise<void>
  sendToUser: (userPubKey: string, event: Partial<UnsignedEvent>) => Promise<string>
  updateLastSeen: (sessionId: string) => void
  deleteInvite: (id: string) => void
  deleteSession: (id: string) => void
  listenToUserDevices: (userPubKey: string) => void
  stopListeningToUserDevices: (userPubKey: string) => void
  getPreferredSession: (userPubKey: string) => string | null
  debugMultiDevice: () => void
}

type SessionStore = SessionStoreState & SessionStoreActions
const subscribe = (filter: Filter, onEvent: (event: VerifiedEvent) => void) => {
  const sub = ndk().subscribe(filter)
  sub.on("event", (e) => onEvent(e as unknown as VerifiedEvent))
  return () => sub.stop()
}

const routeEventToStore = (sessionId: string, message: MessageType) => {
  const from = sessionId.split(":")[0]
  // Set pubkey to the original message pubkey, or from if not set
  if (!message.pubkey || message.pubkey !== "user") {
    message.pubkey = from
  }
  // Check for ['p', recipientPubKey] tag, but only use for routing if authored by us
  const pTag = message.tags?.find((tag: string[]) => tag[0] === "p")
  const groupLabelTag = message.tags?.find((tag: string[]) => tag[0] === "l")
  const myPubKey = useUserStore.getState().publicKey
  let targetId
  if (pTag && pTag[1] && message.pubkey === myPubKey) {
    targetId = pTag[1]
  } else if (groupLabelTag && groupLabelTag[1]) {
    targetId = groupLabelTag[1]
  } else {
    targetId = sessionId
  }
  useEventsStore.getState().upsert(targetId, message)

  // Sync with chats store for private chats
  if (!groupLabelTag && from) {
    // This is a private message, ensure chat exists in chats store
    const chatsStore = usePrivateChatsStore.getState()
    chatsStore.addChat(from)
  }
}

const store = create<SessionStore>()(
  persist(
    (set, get) => ({
      invites: new Map(),
      sessions: new Map(),
      lastSeen: new Map(),
      deviceId: "",
      userDevices: new Map(),
      deviceInviteListeners: new Map(),
      messageQueue: new Map(),
      createDefaultInvites: async () => {
        const myPubKey = useUserStore.getState().publicKey
        if (!myPubKey) {
          throw new Error("No public key")
        }

        console.log("createDefaultInvites called for user:", myPubKey)

        // Get or create device ID
        let deviceId = get().deviceId
        if (!deviceId) {
          const stored = await localforage.getItem<string>("deviceId")
          if (stored) {
            deviceId = stored
            console.log("Using existing device ID:", deviceId)
          } else {
            deviceId = generateDeviceId()
            await localforage.setItem("deviceId", deviceId)
            console.log("Generated new device ID:", deviceId)
          }
          set({deviceId})
        } else {
          console.log("Device ID already set:", deviceId)
        }

        // Create device-specific invite instead of hardcoded "public"
        if (!get().invites.has(deviceId)) {
          console.log("Creating new device invite for:", deviceId)
          get().createInvite(`Device ${deviceId.slice(0, 8)}`, deviceId)
          const invite = get().invites.get(deviceId)
          if (!invite) {
            console.error("Failed to create device invite")
            return
          }
          const event = invite.getEvent() as RawEvent
          console.log("Publishing device invite...", {
            deviceId,
            eventId: event.id,
            tags: event.tags,
          })
          await NDKEventFromRawEvent(event)
            .publish()
            .then((res) => console.log("Successfully published device invite", res))
            .catch((e) => console.warn("Error publishing device invite:", e))
        } else {
          console.log("Device invite already exists, not republishing")
        }

        // Log current invites and sessions for debugging
        console.log("Current invites:", Array.from(get().invites.keys()))
        console.log("Current sessions:", Array.from(get().sessions.keys()))
      },
      deleteInvite: (id: string) => {
        const currentInvites = get().invites
        const newInvites = new Map(currentInvites)
        newInvites.delete(id)
        set({invites: newInvites})
        const unsubscribe = inviteListeners.get(id)
        if (unsubscribe) {
          unsubscribe()
          inviteListeners.delete(id)
        }
      },
      createInvite: (label: string, inviteId?: string) => {
        const myPubKey = useUserStore.getState().publicKey
        const myPrivKey = useUserStore.getState().privateKey
        if (!myPubKey) {
          throw new Error("No public key")
        }
        const invite = Invite.createNew(myPubKey, label)
        const id = inviteId || crypto.randomUUID()
        const currentInvites = get().invites

        const newInvites = new Map(currentInvites)
        newInvites.set(id, invite)
        const decrypt = myPrivKey
          ? hexToBytes(myPrivKey)
          : async (cipherText: string, pubkey: string) => {
              if (window.nostr?.nip44) {
                return window.nostr.nip44.decrypt(pubkey, cipherText)
              }
              throw new Error("No nostr extension or private key")
            }
        const unsubscribe = invite.listen(decrypt, subscribe, (session, identity) => {
          const sessionId = `${identity}:${session.name}`
          if (sessionListeners.has(sessionId)) {
            return
          }

          // Check if we already have a session with this device
          const existingSession = store.getState().sessions.get(sessionId)
          if (existingSession) {
            console.log("Session already exists with this device:", sessionId)
            return
          }

          const newState = createSessionWithLastSeen(
            store.getState().sessions,
            store.getState().lastSeen,
            sessionId,
            session
          )
          store.setState(newState)

          // Track user device
          if (identity) {
            const userPubKey = identity
            const deviceId = session.name || "unknown"
            const userDevices = new Map(store.getState().userDevices)
            const devices = userDevices.get(userPubKey) || new Set()
            devices.add(deviceId)
            userDevices.set(userPubKey, devices)
            store.setState({userDevices})

            // Sync with chats store
            const chatsStore = usePrivateChatsStore.getState()
            chatsStore.addChat(userPubKey)
          }

          const sessionUnsubscribe = session.onEvent((event) => {
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
            routeEventToStore(sessionId, event)
            store.setState({sessions: new Map(store.getState().sessions)})
          })
          sessionListeners.set(sessionId, sessionUnsubscribe)
        })
        inviteListeners.set(id, unsubscribe)
        set({invites: newInvites})
      },
      sendMessage: async (sessionId: string, event: Partial<UnsignedEvent>) => {
        const session = get().sessions.get(sessionId)
        if (!session) {
          throw new Error("Session not found")
        }
        if (event.kind === REACTION_KIND && !event.tags?.find((tag) => tag[0] === "e")) {
          throw new Error("Cannot send a reaction without a replyingToId")
        }
        const {event: publishedEvent, innerEvent} = session.sendEvent(event)
        const message: MessageType = {
          ...innerEvent,
          pubkey: "user",
          reactions: {},
        }
        // Optimistic update
        routeEventToStore(sessionId, message)
        try {
          const e = NDKEventFromRawEvent(publishedEvent)
          await e.publish(undefined, undefined, 0) // required relay count 0
          console.log("published", publishedEvent.id)
        } catch (err) {
          console.warn("Error publishing event:", err)
        }
        // make sure we persist session state
        set({sessions: new Map(get().sessions)})
      },
      sendToUser: async (
        userPubKey: string,
        event: Partial<UnsignedEvent>
      ): Promise<string> => {
        console.log("sendToUser:", {userPubKey, event})

        if (!event.created_at) {
          event.created_at = Math.round(Date.now() / 1000)
        }
        if (!event.tags?.some((tag) => tag[0] === "ms")) {
          event.tags = [["ms", Date.now().toString()]]
        }

        // Get all existing sessions with this user
        const userSessions = Array.from(get().sessions.entries()).filter(([sessionId]) =>
          sessionId.startsWith(`${userPubKey}:`)
        )

        console.log(`Found ${userSessions.length} sessions for user`)

        if (userSessions.length > 0) {
          // Get preferred session (most recently active)
          const preferredSessionId =
            get().getPreferredSession(userPubKey) || userSessions[0][0]

          // Send only to preferred session
          try {
            await get().sendMessage(preferredSessionId, event)
            console.log(`Sent to preferred session: ${preferredSessionId}`)
            return preferredSessionId
          } catch (error) {
            console.warn(
              `Error sending to preferred session ${preferredSessionId}:`,
              error
            )
            throw error
          }
        }

        console.log("No existing sessions, queuing message and listening for invites")

        // No existing sessions, check if we have queued messages
        // Try to create session via Invite.fromUser with timeout and queuing
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            cleanup()
            reject(new Error("Timeout waiting for user invite"))
          }, 10000) // 10 second timeout

          // Start listening for user devices
          get().listenToUserDevices(userPubKey)

          const unsubscribe = Invite.fromUser(userPubKey, subscribe, async (invite) => {
            try {
              cleanup()
              const sessionId = await get().acceptInvite(invite.getUrl())

              // Process any queued messages first
              const queue = get().messageQueue.get(userPubKey) || []
              if (queue.length > 0) {
                for (const {event: queuedEvent, resolve: queuedResolve} of queue) {
                  try {
                    await get().sendMessage(sessionId, queuedEvent)
                    queuedResolve(sessionId)
                  } catch (error) {
                    console.warn("Error sending queued message:", error)
                  }
                }
                // Clear the queue
                const newQueue = new Map(get().messageQueue)
                newQueue.delete(userPubKey)
                set({messageQueue: newQueue})
              }

              // Send the current message
              await get().sendMessage(sessionId, event)
              console.log("sendToUser new sessionId:", sessionId)
              resolve(sessionId)
            } catch (error) {
              reject(error)
            }
          })

          const cleanup = () => {
            if (timeoutId) clearTimeout(timeoutId)
            if (unsubscribe) unsubscribe()
          }

          // Queue the message while waiting for session
          const messageQueue = new Map(get().messageQueue)
          const queue = messageQueue.get(userPubKey) || []
          queue.push({event, resolve})
          messageQueue.set(userPubKey, queue)
          set({messageQueue})
        })
      },
      acceptInvite: async (url: string): Promise<string> => {
        const invite = Invite.fromUrl(url)
        const myPubKey = useUserStore.getState().publicKey
        if (!myPubKey) {
          throw new Error("No public key")
        }

        const inviteKey = `${invite.inviter}:${invite.deviceId || "unknown"}`

        // Prevent concurrent invite acceptance
        if (pendingInvites.has(inviteKey)) {
          console.log("Invite already being processed:", inviteKey)
          // Wait a bit and check if session was created
          await new Promise((resolve) => setTimeout(resolve, 1000))
          const existingSession = get().sessions.get(inviteKey)
          if (existingSession) {
            return inviteKey
          }
        }

        pendingInvites.add(inviteKey)

        try {
          console.log("acceptInvite called:", {
            inviter: invite.inviter,
            deviceId: invite.deviceId,
            url: url.slice(0, 50) + "...",
          })

          // Check if we already have ANY session with this user
          const existingSessions = Array.from(get().sessions.keys()).filter((sessionId) =>
            sessionId.startsWith(`${invite.inviter}:`)
          )

          console.log("Existing sessions with user:", existingSessions)

          // Check if we already have a session with this specific device
          const deviceId = invite.deviceId || "unknown"
          const potentialSessionId = `${invite.inviter}:${deviceId}`
          const existingSession = get().sessions.get(potentialSessionId)

          if (existingSession) {
            console.log("Session already exists with this device:", potentialSessionId)
            return potentialSessionId
          }

          // If we have any existing session with this user, let's use the first one
          // instead of creating a new one (for now, to prevent duplicates)
          if (existingSessions.length > 0) {
            console.log(
              "Using existing session instead of creating new:",
              existingSessions[0]
            )
            return existingSessions[0]
          }

          console.log("Creating new session for:", potentialSessionId)

          const myPrivKey = useUserStore.getState().privateKey
          const encrypt = myPrivKey
            ? hexToBytes(myPrivKey)
            : async (plaintext: string, pubkey: string) => {
                if (window.nostr?.nip44) {
                  return window.nostr.nip44.encrypt(pubkey, plaintext)
                }
                throw new Error("No nostr extension or private key")
              }
          const {session, event} = await invite.accept(
            (filter, onEvent) => subscribe(filter, onEvent),
            myPubKey,
            encrypt
          )
          const e = NDKEventFromRawEvent(event)
          await e
            .publish()
            .then((res) => console.log("published", res))
            .catch((e) => console.warn("Error publishing event:", e))
          const sessionId = `${invite.inviter}:${session.name}`

          console.log("Created sessionId:", sessionId)

          if (sessionListeners.has(sessionId)) {
            return sessionId
          }
          const newState = createSessionWithLastSeen(
            get().sessions,
            get().lastSeen,
            sessionId,
            session
          )
          const sessionUnsubscribe = session.onEvent((event) => {
            routeEventToStore(sessionId, event)
            // make sure we persist session state
            set({sessions: new Map(get().sessions)})
          })
          sessionListeners.set(sessionId, sessionUnsubscribe)
          set(newState)

          // Sync with chats store
          const userPubKey = invite.inviter
          const chatsStore = usePrivateChatsStore.getState()
          chatsStore.addChat(userPubKey)

          return sessionId
        } finally {
          // Always remove from pending set
          pendingInvites.delete(inviteKey)
        }
      },
      updateLastSeen: (sessionId: string) => {
        const newLastSeen = new Map(get().lastSeen)
        newLastSeen.set(sessionId, Date.now())
        set({lastSeen: newLastSeen})
      },
      deleteSession: (sessionId: string) => {
        const newSessions = new Map(get().sessions)
        newSessions.delete(sessionId)
        set({sessions: newSessions})
        const unsubscribe = sessionListeners.get(sessionId)
        if (unsubscribe) {
          unsubscribe()
          sessionListeners.delete(sessionId)
        }
        useEventsStore.getState().removeSession(sessionId)
      },
      listenToUserDevices: (userPubKey: string) => {
        const deviceId = get().deviceId
        if (!deviceId) {
          console.warn("Device ID not available, cannot listen to user devices.")
          return
        }
        const key = `${userPubKey}:${deviceId}`
        if (get().deviceInviteListeners.has(key)) {
          console.log("Already listening to user devices for:", userPubKey)
          return
        }

        console.log("Starting to listen for device invites from user:", userPubKey)

        const unsubscribe = Invite.fromUser(userPubKey, subscribe, async (invite) => {
          try {
            console.log("Found invite from user:", {
              userPubKey,
              inviteDeviceId: invite.deviceId,
              ourDeviceId: deviceId,
            })

            const sessionId = await get().acceptInvite(invite.getUrl())
            const session = get().sessions.get(sessionId)
            if (session) {
              const newDevices = new Set(get().userDevices.get(userPubKey) || [])
              const inviteDeviceId = invite.deviceId || "unknown"
              newDevices.add(inviteDeviceId)
              set({userDevices: new Map(get().userDevices).set(userPubKey, newDevices)})
              console.log(
                "Updated user devices for",
                userPubKey,
                ":",
                Array.from(newDevices)
              )
            }
          } catch (error) {
            console.warn("Error accepting user device invite:", error)
          }
        })
        get().deviceInviteListeners.set(key, unsubscribe)
        console.log("Set up device invite listener for:", key)
      },
      stopListeningToUserDevices: (userPubKey: string) => {
        const deviceId = get().deviceId
        if (!deviceId) {
          return
        }
        const key = `${userPubKey}:${deviceId}`
        const unsubscribe = get().deviceInviteListeners.get(key)
        if (unsubscribe) {
          unsubscribe()
          get().deviceInviteListeners.delete(key)
        }
      },
      getPreferredSession: (userPubKey: string) => {
        const userDevices = get().userDevices.get(userPubKey) || new Set()
        const sessions = Array.from(get().sessions.entries()).filter(([sessionId]) => {
          const from = sessionId.split(":")[0]
          return from === userPubKey && userDevices.has(sessionId.split(":")[1])
        })
        if (sessions.length === 0) {
          return null
        }
        // Sort by last seen
        sessions.sort(([id1], [id2]) => {
          const lastSeen1 = get().lastSeen.get(id1) || 0
          const lastSeen2 = get().lastSeen.get(id2) || 0
          return lastSeen2 - lastSeen1
        })
        return sessions[0][0]
      },
      debugMultiDevice: () => {
        console.log("=== MULTI-DEVICE DEBUG STATE ===")
        console.log("Device ID:", get().deviceId)
        console.log("Current Sessions:")
        Array.from(get().sessions.entries()).forEach(([id, session]) => {
          const lastSeen = get().lastSeen.get(id) || "N/A"
          console.log(`  - ${id}: ${session.name} (Last seen: ${lastSeen})`)
        })
        console.log("Current Invites:")
        Array.from(get().invites.entries()).forEach(([id, invite]) => {
          console.log(`  - ${id}: Inviter ${invite.inviter}`)
        })
        console.log("Current User Devices:")
        Array.from(get().userDevices.entries()).forEach(([userPubKey, deviceIds]) => {
          console.log(`  - ${userPubKey}: ${Array.from(deviceIds).join(", ")}`)
        })
        console.log("Current Message Queue:")
        Array.from(get().messageQueue.entries()).forEach(([userPubKey, queue]) => {
          console.log(`  - ${userPubKey}: ${queue.length} messages`)
        })
        console.log("Device Invite Listeners:")
        console.log(`  - Active listeners: ${get().deviceInviteListeners.size}`)
        Array.from(get().deviceInviteListeners.keys()).forEach((key) => {
          console.log(`    - ${key}`)
        })
        console.log("=================================")
      },
    }),
    {
      name: "sessions",
      onRehydrateStorage: () => async (state) => {
        await useUserStore.getState().awaitHydration()

        // Initialize device ID if not set
        if (!state?.deviceId) {
          const stored = await localforage.getItem<string>("deviceId")
          const deviceId = stored || generateDeviceId()
          if (!stored) {
            await localforage.setItem("deviceId", deviceId)
          }
          store.setState({deviceId})
        }

        const privateKey = useUserStore.getState().privateKey
        const decrypt = privateKey
          ? hexToBytes(privateKey)
          : async (cipherText: string, pubkey: string) => {
              if (window.nostr?.nip44) {
                return window.nostr.nip44.decrypt(pubkey, cipherText)
              }
              throw new Error("No nostr extension or private key")
            }

        Array.from(state?.invites || []).forEach(([id, invite]) => {
          if (inviteListeners.has(id)) {
            return
          }
          const inviteUnsubscribe = invite.listen(
            decrypt,
            subscribe,
            (session, identity) => {
              const sessionId = `${identity}:${session.name}`
              if (sessionListeners.has(sessionId)) {
                return
              }
              const newState = createSessionWithLastSeen(
                store.getState().sessions,
                store.getState().lastSeen,
                sessionId,
                session
              )
              store.setState(newState)

              // Track user device
              if (identity) {
                const userPubKey = identity
                const deviceId = session.name || "unknown"
                const userDevices = new Map(store.getState().userDevices)
                const devices = userDevices.get(userPubKey) || new Set()
                devices.add(deviceId)
                userDevices.set(userPubKey, devices)
                store.setState({userDevices})

                // Sync with chats store
                const chatsStore = usePrivateChatsStore.getState()
                chatsStore.addChat(userPubKey)
              }

              const sessionUnsubscribe = session.onEvent((event) => {
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
                routeEventToStore(sessionId, event)
                store.setState({sessions: new Map(store.getState().sessions)})
              })
              sessionListeners.set(sessionId, sessionUnsubscribe)
            }
          )
          inviteListeners.set(id, inviteUnsubscribe)
        })

        Array.from(state?.sessions || []).forEach(([sessionId, session]) => {
          if (sessionListeners.has(sessionId)) {
            return
          }
          // Ensure lastSeen entry exists for rehydrated sessions
          const currentLastSeen = store.getState().lastSeen
          if (!currentLastSeen.has(sessionId)) {
            const newLastSeen = new Map(currentLastSeen)
            newLastSeen.set(sessionId, Date.now())
            store.setState({lastSeen: newLastSeen})
          }

          // Track user device from session ID
          const parts = sessionId.split(":", 2)
          const userPubKey = parts[0]
          const deviceId = parts[1] || "unknown"
          const userDevices = new Map(store.getState().userDevices)
          const devices = userDevices.get(userPubKey) || new Set()
          devices.add(deviceId)
          userDevices.set(userPubKey, devices)
          store.setState({userDevices})

          const sessionUnsubscribe = session.onEvent((event) => {
            // Handle group creation event (kind 40)
            if (event.kind === 40 && event.content) {
              try {
                const group = JSON.parse(event.content)
                const groups = useGroupsStore.getState().groups
                if (!groups[group.id]) {
                  useGroupsStore.getState().addGroup(group)
                }
                console.log("group created", group)
              } catch (e) {
                console.warn("Failed to parse group from kind 40 event", e)
              }
            }
            routeEventToStore(sessionId, event)
            store.setState({sessions: new Map(store.getState().sessions)})
          })
          sessionListeners.set(sessionId, sessionUnsubscribe)
        })

        // Start listening to device invites for users we have sessions with
        const userPubKeys = new Set<string>()
        Array.from(state?.sessions || []).forEach(([sessionId]) => {
          const userPubKey = sessionId.split(":")[0]
          userPubKeys.add(userPubKey)
        })

        userPubKeys.forEach((userPubKey) => {
          store.getState().listenToUserDevices(userPubKey)
        })
      },
      storage: forceMigrationOnInitialPersist(
        createJSONStorage(() => localforage),
        JSON.parse(localStorage.getItem("sessions") || "null")
      ),
      version: 1,
      migrate: async (oldData: unknown, version) => {
        if (version === 0 && oldData) {
          const data = {
            version: 1,
            state: oldData as SessionStore,
          }

          const dataString = JSON.stringify(data)

          await localforage.setItem("sessions", dataString)

          return data.state
        }
      },
      partialize: (state) => {
        return {
          invites: Array.from(state.invites.entries()).map((entry) => {
            const [id, invite] = entry as [string, Invite]
            return [id, invite.serialize()]
          }),
          sessions: Array.from(state.sessions.entries()).map((entry) => {
            const [id, session] = entry as [string, Session]
            return [id, serializeSessionState(session.state)]
          }),
          lastSeen: Array.from(state.lastSeen.entries()),
          deviceId: state.deviceId,
          userDevices: Array.from(state.userDevices.entries()).map(
            ([userPubKey, deviceIds]) => [userPubKey, Array.from(deviceIds)]
          ),
        }
      },
      merge: (persistedState: unknown, currentState: SessionStore) => {
        const state = (persistedState || {
          invites: [],
          sessions: [],
          lastSeen: [],
          deviceId: "",
          userDevices: [],
        }) as {
          invites: [string, string][]
          sessions: [string, string][]
          lastSeen: [string, number][]
          deviceId: string
          userDevices: [string, string[]][]
        }
        const newSessions: [string, Session][] = state.sessions.map(
          ([id, sessionState]: [string, string]) => {
            const session = new Session(subscribe, deserializeSessionState(sessionState))
            return [id, session] as [string, Session]
          }
        )
        const newInvites: [string, Invite][] = state.invites.map(
          (entry: [string, string]) => {
            const [id, invite] = entry
            return [id, Invite.deserialize(invite)] as [string, Invite]
          }
        )
        const userDevicesMap = new Map<string, Set<string>>(
          (state.userDevices || []).map(([userPubKey, deviceIds]) => [
            userPubKey,
            new Set(deviceIds),
          ])
        )
        return {
          ...currentState,
          invites: new Map<string, Invite>(newInvites),
          sessions: new Map<string, Session>(newSessions),
          lastSeen: new Map<string, number>(state.lastSeen || []),
          deviceId: state.deviceId,
          userDevices: userDevicesMap,
          deviceInviteListeners: new Map<string, () => void>(),
          messageQueue: new Map<
            string,
            Array<{event: Partial<UnsignedEvent>; resolve: (sessionId: string) => void}>
          >(),
        }
      },
    }
  )
)

export const useSessionsStore = store
