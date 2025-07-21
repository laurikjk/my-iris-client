import {Invite, Session} from "nostr-double-ratchet/src"
import {createJSONStorage, persist} from "zustand/middleware"
import {Filter, VerifiedEvent, UnsignedEvent} from "nostr-tools"
import {NDKEventFromRawEvent, RawEvent} from "@/utils/nostr"
import {REACTION_KIND} from "@/pages/chats/utils/constants"
import type {MessageType} from "@/pages/chats/message/Message"
import {hexToBytes} from "@noble/hashes/utils"
import {useEventsStore} from "./events"
import {UserRecord} from "./UserRecord"
import localforage from "localforage"
import {useUserStore} from "./user"
import {ndk} from "@/utils/ndk"
import {create} from "zustand"
import {useGroupsStore} from "./groups"
import {usePrivateChatsStore} from "./privateChats"

const generateDeviceId = (): string => {
  return crypto.randomUUID()
}

interface UserRecordsStoreState {
  invites: Map<string, Invite>
  userRecords: Map<string, UserRecord> // userPubKey -> UserRecord
  lastSeen: Map<string, number> // sessionId -> timestamp (for UI compatibility)
  deviceId: string
  deviceInviteListeners: Map<string, () => void>
  messageQueue: Map<
    string,
    Array<{event: Partial<UnsignedEvent>; resolve: (sessionId: string) => void}>
  >
}

interface UserRecordsStoreActions {
  // Core session management
  createInvite: (label: string, inviteId?: string) => void
  createDefaultInvites: () => void
  acceptInvite: (url: string) => Promise<string>
  sendMessage: (sessionId: string, event: Partial<UnsignedEvent>) => Promise<void>
  sendToUser: (userPubKey: string, event: Partial<UnsignedEvent>) => Promise<string>
  updateLastSeen: (sessionId: string) => void
  deleteInvite: (id: string) => void
  deleteSession: (sessionId: string) => void

  // Device management
  listenToUserDevices: (userPubKey: string) => void
  stopListeningToUserDevices: (userPubKey: string) => void

  // Session selection
  getPreferredSession: (userPubKey: string) => string | null

  // Debug & maintenance
  debugMultiDevice: () => void
  manualDeviceDiscovery: () => void
  cleanupInvites: () => void
  getOwnDeviceInvites: () => Map<string, Invite>
  cleanupDuplicateSessions: () => void

  // Compatibility API (for existing components)
  sessions: Map<string, Session> // Virtual getter for backward compatibility
}

type UserRecordsStore = UserRecordsStoreState & UserRecordsStoreActions

// Subscribe function for nostr events
const subscribe = (filter: Filter, onEvent: (event: VerifiedEvent) => void) => {
  const sub = ndk().subscribe(filter)
  sub.on("event", (e) => onEvent(e as unknown as VerifiedEvent))
  return () => sub.stop()
}

// Route events to the events store
const routeEventToStore = (sessionId: string, message: MessageType) => {
  const {userPubKey} = UserRecord.parseSessionId(sessionId)
  // Set pubkey to the original message pubkey, or from if not set
  if (!message.pubkey || message.pubkey !== "user") {
    message.pubkey = userPubKey
  }

  // Check for ['p', recipientPubKey] tag, but only use for routing if authored by us
  const pTag = message.tags?.find((tag: string[]) => tag[0] === "p")
  const groupLabelTag = message.tags?.find((tag: string[]) => tag[0] === "l")
  const myPubKey = useUserStore.getState().publicKey
  let targetId

  if (groupLabelTag && groupLabelTag[1]) {
    // Group message - store by group ID
    targetId = groupLabelTag[1]
  } else if (
    pTag &&
    pTag[1] &&
    (message.pubkey === myPubKey || message.pubkey === "user")
  ) {
    // Message sent by us with recipient tag - store by recipient pubkey
    targetId = pTag[1]
  } else {
    // Private message - always store by the other user's pubkey, not sessionId
    targetId = userPubKey
  }

  useEventsStore.getState().upsert(targetId, message)

  // Sync with chats store for private chats
  if (!groupLabelTag && userPubKey) {
    const chatsStore = usePrivateChatsStore.getState()
    chatsStore.addChat(userPubKey)
  }
}

// Global listeners tracking
const inviteListeners = new Map<string, () => void>()
const sessionListeners = new Map<string, () => void>()
const pendingInvites = new Set<string>()

export const useUserRecordsStore = create<UserRecordsStore>()(
  persist(
    (set, get) => ({
      invites: new Map(),
      userRecords: new Map(),
      lastSeen: new Map(),
      deviceId: "",
      deviceInviteListeners: new Map(),
      messageQueue: new Map(),

      // Virtual sessions getter for backward compatibility
      get sessions() {
        const virtualSessions = new Map<string, Session>()
        const userRecords = get().userRecords

        for (const [userPubKey, userRecord] of userRecords.entries()) {
          for (const device of userRecord.getActiveDevices()) {
            if (device.activeSession) {
              const sessionId = `${userPubKey}:${device.deviceId}`
              virtualSessions.set(sessionId, device.activeSession)
            }
          }
        }

        return virtualSessions
      },

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
        }

        // Create device-specific invite
        if (!get().invites.has(deviceId)) {
          console.log("Creating new device invite for:", deviceId)
          get().createInvite(`Device ${deviceId.slice(0, 8)}`, deviceId)
          const invite = get().invites.get(deviceId)
          if (!invite) {
            console.error("Failed to create device invite")
            return
          }
          const event = invite.getEvent() as RawEvent
          console.log("Publishing device invite...", {deviceId, eventId: event.id})
          await NDKEventFromRawEvent(event)
            .publish()
            .then((res) => console.log("Successfully published device invite", res))
            .catch((e) => console.warn("Error publishing device invite:", e))
        }

        console.log("Current invites:", Array.from(get().invites.keys()))
        console.log("Current userRecords:", Array.from(get().userRecords.keys()))
      },

      createInvite: (label: string, inviteId?: string) => {
        const myPubKey = useUserStore.getState().publicKey
        const myPrivKey = useUserStore.getState().privateKey
        if (!myPubKey) {
          throw new Error("No public key")
        }

        const id = inviteId || crypto.randomUUID()
        const invite = Invite.createNew(myPubKey, id) // Pass deviceId as second parameter
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
          if (!identity) return

          // Use the invite's deviceId, not session.name
          const deviceId = id // This is the deviceId we passed to createNew
          const sessionId = `${identity}:${deviceId}`
          if (sessionListeners.has(sessionId)) {
            return
          }

          // Get or create UserRecord
          const userRecords = new Map(get().userRecords)
          let userRecord = userRecords.get(identity)
          if (!userRecord) {
            userRecord = new UserRecord(identity, identity)
            userRecords.set(identity, userRecord)
          }

          // Add session to UserRecord with proper deviceId
          userRecord.upsertSession(deviceId, session)

          // Update last seen
          const lastSeen = new Map(get().lastSeen)
          lastSeen.set(sessionId, Date.now())

          set({userRecords, lastSeen})

          // Set up session listener
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
            set({userRecords: new Map(get().userRecords)})
          })
          sessionListeners.set(sessionId, sessionUnsubscribe)

          // Sync with chats store
          const chatsStore = usePrivateChatsStore.getState()
          chatsStore.addChat(identity)
        })

        inviteListeners.set(id, unsubscribe)
        set({invites: newInvites})
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

      sendMessage: async (sessionId: string, event: Partial<UnsignedEvent>) => {
        const {userPubKey, deviceId} = UserRecord.parseSessionId(sessionId)
        const userRecord = get().userRecords.get(userPubKey)
        const session = userRecord?.getActiveSession(deviceId)

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
          await e.publish(undefined, undefined, 0)
          console.log("published", publishedEvent.id)
        } catch (err) {
          console.warn("Error publishing event:", err)
        }

        // Persist session state
        set({userRecords: new Map(get().userRecords)})
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

        const myPubKey = useUserStore.getState().publicKey
        const myDeviceId = get().deviceId

        // Get UserRecord for this user
        const userRecord = get().userRecords.get(userPubKey)

        if (userPubKey === myPubKey) {
          // Sending to self - handle specially
          console.log("Sending to self")

          if (userRecord) {
            const otherDevices = userRecord
              .getActiveDevices()
              .filter((device) => device.deviceId !== myDeviceId)

            if (otherDevices.length > 0) {
              // Send to most active other device
              const mostActiveDevice = userRecord.getMostActiveDevice()
              if (mostActiveDevice && mostActiveDevice.activeSession) {
                try {
                  const sessionId = `${userPubKey}:${mostActiveDevice.deviceId}`
                  await get().sendMessage(sessionId, event)
                  console.log(`Sent to other device session: ${sessionId}`)
                } catch (error) {
                  console.warn(`Error sending to other device:`, error)
                }
              }
            }
          }

          // Always store locally when sending to self
          const message: MessageType = {
            ...event,
            id: crypto.randomUUID(),
            pubkey: "user",
            reactions: {},
            created_at: event.created_at || Math.round(Date.now() / 1000),
            tags: event.tags || [],
          } as MessageType

          routeEventToStore(`${userPubKey}:local`, message)
          return `${userPubKey}:self`
        }

        if (userRecord && userRecord.hasActiveSessions()) {
          // Send to preferred session
          const preferredSession = userRecord.getPreferredSession()
          if (preferredSession) {
            const preferredDevice = userRecord.getMostActiveDevice()
            if (preferredDevice) {
              const sessionId = `${userPubKey}:${preferredDevice.deviceId}`
              try {
                await get().sendMessage(sessionId, event)
                console.log(`Sent to preferred session: ${sessionId}`)
                return sessionId
              } catch (error) {
                console.warn(`Error sending to preferred session:`, error)
                throw error
              }
            }
          }
        }

        // No existing sessions - listen for invites and queue message
        console.log("No existing sessions, queuing message and listening for invites")

        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            cleanup()
            reject(new Error("Timeout waiting for user invite"))
          }, 10000)

          get().listenToUserDevices(userPubKey)

          const unsubscribe = Invite.fromUser(userPubKey, subscribe, async (invite) => {
            try {
              if (invite.inviter !== userPubKey) {
                console.warn("Received invite from unexpected user:", {
                  expected: userPubKey,
                  actual: invite.inviter,
                })
                return
              }

              cleanup()
              const sessionId = await get().acceptInvite(invite.getUrl())

              // Process any queued messages
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
                const newQueue = new Map(get().messageQueue)
                newQueue.delete(userPubKey)
                set({messageQueue: newQueue})
              }

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

          // Queue the message
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

        if (pendingInvites.has(inviteKey)) {
          console.log("Invite already being processed:", inviteKey)
          await new Promise((resolve) => setTimeout(resolve, 1000))
          const userRecord = get().userRecords.get(invite.inviter)
          const existingSession = userRecord?.getActiveSession(
            invite.deviceId || "unknown"
          )
          if (existingSession) {
            return inviteKey
          }
        }

        pendingInvites.add(inviteKey)

        try {
          const deviceId = invite.deviceId || "unknown"
          console.log("acceptInvite called:", {
            inviter: invite.inviter,
            deviceId: invite.deviceId,
            actualDeviceId: deviceId,
          })
          const userRecord = get().userRecords.get(invite.inviter)
          const existingSession = userRecord?.getActiveSession(deviceId)

          if (existingSession) {
            console.log("Session already exists with this device:", inviteKey)
            return inviteKey
          }

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

          // Use the actual deviceId from invite, not session.name
          const sessionId = `${invite.inviter}:${deviceId}`

          // Get or create UserRecord
          const userRecords = new Map(get().userRecords)
          let targetUserRecord = userRecords.get(invite.inviter)
          if (!targetUserRecord) {
            targetUserRecord = new UserRecord(invite.inviter, invite.inviter)
            userRecords.set(invite.inviter, targetUserRecord)
          }

          // Add session to UserRecord
          targetUserRecord.upsertSession(deviceId, session)

          // Update last seen
          const lastSeen = new Map(get().lastSeen)
          lastSeen.set(sessionId, Date.now())

          set({userRecords, lastSeen})

          if (!sessionListeners.has(sessionId)) {
            const sessionUnsubscribe = session.onEvent((event) => {
              routeEventToStore(sessionId, event)
              set({userRecords: new Map(get().userRecords)})
            })
            sessionListeners.set(sessionId, sessionUnsubscribe)
          }

          // Sync with chats store
          const chatsStore = usePrivateChatsStore.getState()
          chatsStore.addChat(invite.inviter)

          // After accepting invite, ensure we store the invite itself so that ChatSettings can list the device
          const invitesMap = new Map(get().invites)
          const deviceInviteKey = invite.deviceId || crypto.randomUUID()
          invitesMap.set(deviceInviteKey, invite)
          set({invites: invitesMap})

          return sessionId
        } finally {
          pendingInvites.delete(inviteKey)
        }
      },

      updateLastSeen: (sessionId: string) => {
        const newLastSeen = new Map(get().lastSeen)
        newLastSeen.set(sessionId, Date.now())
        set({lastSeen: newLastSeen})
      },

      deleteSession: (sessionId: string) => {
        const {userPubKey, deviceId} = UserRecord.parseSessionId(sessionId)
        const userRecords = new Map(get().userRecords)
        const userRecord = userRecords.get(userPubKey)

        if (userRecord) {
          userRecord.deleteSession(deviceId)
          if (userRecord.getTotalSessionCount() === 0) {
            userRecords.delete(userPubKey)
          }
        }

        set({userRecords})

        const unsubscribe = sessionListeners.get(sessionId)
        if (unsubscribe) {
          unsubscribe()
          sessionListeners.delete(sessionId)
        }
        useEventsStore.getState().removeSession(sessionId)
      },

      listenToUserDevices: (userPubKey: string) => {
        const myPubKey = useUserStore.getState().publicKey

        if (get().deviceInviteListeners.has(userPubKey)) {
          console.log("Already listening to user devices for:", userPubKey)
          return
        }

        console.log("Starting to listen for device invites from user:", userPubKey)

        const unsubscribe = Invite.fromUser(userPubKey, subscribe, async (invite) => {
          console.log("Received invite from user:", {
            inviter: invite.inviter,
            deviceId: invite.deviceId,
          })
          try {
            if (invite.inviter !== userPubKey) {
              console.warn("Received invite from unexpected user:", {
                expected: userPubKey,
                actual: invite.inviter,
              })
              return
            }

            const inviteDeviceId = invite.deviceId || "unknown"
            
            // Get device ID the same way createDefaultInvites does
            let ourDeviceId = get().deviceId
            if (!ourDeviceId) {
              const stored = await localforage.getItem<string>("deviceId")
              if (stored) {
                ourDeviceId = stored
                // Update the store with the device ID we found
                set({deviceId: stored})
              }
            }

            console.log("ourDeviceId", ourDeviceId)

            if (userPubKey === myPubKey && inviteDeviceId === ourDeviceId) {
              console.log(
                "Skipping invite from our own device to prevent loop:",
                inviteDeviceId
              )
              return
            }

            const userRecord = get().userRecords.get(userPubKey)
            console.log("Checking for existing session with deviceId:", inviteDeviceId)
            const existingSession = userRecord?.getActiveSession(inviteDeviceId)

            if (existingSession) {
              console.log(
                "Session already exists with this device, skipping invite",
                inviteDeviceId
              )
              return
            }

            // Accept invite directly instead of converting to URL to preserve deviceId
            const inviteKey = `${invite.inviter}:${inviteDeviceId}`

            if (pendingInvites.has(inviteKey)) {
              console.log("Invite already being processed:", inviteKey)
              return
            }

            pendingInvites.add(inviteKey)

            try {
              console.log("Accepting invite directly with deviceId:", inviteDeviceId)

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

              const sessionId = `${invite.inviter}:${inviteDeviceId}`

              // Get or create UserRecord
              const userRecords = new Map(get().userRecords)
              let targetUserRecord = userRecords.get(invite.inviter)
              if (!targetUserRecord) {
                targetUserRecord = new UserRecord(invite.inviter, invite.inviter)
                userRecords.set(invite.inviter, targetUserRecord)
              }

              // Add session to UserRecord
              targetUserRecord.upsertSession(inviteDeviceId, session)

              // Update last seen
              const lastSeen = new Map(get().lastSeen)
              lastSeen.set(sessionId, Date.now())

              set({userRecords, lastSeen})

              if (!sessionListeners.has(sessionId)) {
                const sessionUnsubscribe = session.onEvent((event) => {
                  routeEventToStore(sessionId, event)
                  set({userRecords: new Map(get().userRecords)})
                })
                sessionListeners.set(sessionId, sessionUnsubscribe)
              }

              // Sync with chats store
              const chatsStore = usePrivateChatsStore.getState()
              chatsStore.addChat(invite.inviter)

              // Store the invite itself
              const invitesMap = new Map(get().invites)
              invitesMap.set(inviteDeviceId, invite)
              set({invites: invitesMap})

              console.log("Accepted invite from user device:", sessionId)
            } finally {
              pendingInvites.delete(inviteKey)
            }
          } catch (error) {
            console.warn("Error accepting user device invite:", error)
          }
        })

        const listeners = new Map(get().deviceInviteListeners)
        listeners.set(userPubKey, unsubscribe)
        set({deviceInviteListeners: listeners})
      },

      stopListeningToUserDevices: (userPubKey: string) => {
        const deviceId = get().deviceId
        const key = `${userPubKey}:${deviceId}`
        const listeners = get().deviceInviteListeners
        const unsubscribe = listeners.get(key)

        if (unsubscribe) {
          unsubscribe()
          const newListeners = new Map(listeners)
          newListeners.delete(key)
          set({deviceInviteListeners: newListeners})
          console.log("Stopped listening to user devices for:", userPubKey)
        }
      },

      getPreferredSession: (userPubKey: string) => {
        const userRecord = get().userRecords.get(userPubKey)
        return userRecord?.getPreferredSessionId() || null
      },

      debugMultiDevice: () => {
        const myPubKey = useUserStore.getState().publicKey
        console.log("=== Multi-Device Debug Info ===")
        console.log("My Public Key:", myPubKey)
        console.log("Device ID:", get().deviceId)

        console.log("Current User Records:")
        Array.from(get().userRecords.entries()).forEach(([userPubKey, userRecord]) => {
          console.log(`  - ${userPubKey}:`)
          console.log(`    - Devices: ${userRecord.getDeviceCount()}`)
          console.log(`    - Active Sessions: ${userRecord.getActiveSessionCount()}`)
          userRecord.getActiveDevices().forEach((device) => {
            console.log(
              `      - ${device.deviceId}: ${device.activeSession ? "active" : "no session"}`
            )
          })
        })
      },

      manualDeviceDiscovery: () => {
        const myPubKey = useUserStore.getState().publicKey
        if (!myPubKey) {
          console.error("No public key available")
          return
        }
        console.log("Manually triggering device discovery for:", myPubKey)
        get().stopListeningToUserDevices(myPubKey)
        get().listenToUserDevices(myPubKey)
      },

      cleanupInvites: () => {
        const myPubKey = useUserStore.getState().publicKey
        if (!myPubKey) {
          console.error("No public key available for cleanup")
          return
        }

        console.log("Cleaning up invites...")
        const currentInvites = get().invites
        const ownInvites = new Map<string, Invite>()
        let removedCount = 0

        Array.from(currentInvites.entries()).forEach(([id, invite]) => {
          if (invite.inviter === myPubKey) {
            ownInvites.set(id, invite)
          } else {
            const unsubscribe = inviteListeners.get(id)
            if (unsubscribe) {
              unsubscribe()
              inviteListeners.delete(id)
            }
            removedCount++
          }
        })

        set({invites: ownInvites})
        console.log(
          `Cleaned up ${removedCount} foreign invites, kept ${ownInvites.size} own invites`
        )
      },

      getOwnDeviceInvites: () => {
        const myPubKey = useUserStore.getState().publicKey
        if (!myPubKey) {
          return new Map()
        }

        const ownInvites = new Map<string, Invite>()
        Array.from(get().invites.entries()).forEach(([id, invite]) => {
          if (invite.inviter === myPubKey) {
            ownInvites.set(id, invite)
          }
        })

        return ownInvites
      },

      cleanupDuplicateSessions: () => {
        console.log("Cleaning up duplicate sessions...")
        const myPubKey = useUserStore.getState().publicKey
        if (!myPubKey) {
          console.error("No public key available")
          return
        }

        const myUserRecord = get().userRecords.get(myPubKey)
        if (!myUserRecord) {
          console.log("No user record found for self")
          return
        }

        // Remove duplicate devices (keep most recent)
        const devices = myUserRecord.getAllDevices()
        const deviceGroups = new Map<string, typeof devices>()

        devices.forEach((device) => {
          const key = device.deviceId
          if (!deviceGroups.has(key)) {
            deviceGroups.set(key, [])
          }
          deviceGroups.get(key)!.push(device)
        })

        let removedCount = 0
        deviceGroups.forEach((deviceGroup) => {
          if (deviceGroup.length > 1) {
            // Keep the most recently active device
            deviceGroup.sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0))
            for (let i = 1; i < deviceGroup.length; i++) {
              myUserRecord.removeDevice(deviceGroup[i].deviceId)
              removedCount++
            }
          }
        })

        if (removedCount > 0) {
          set({userRecords: new Map(get().userRecords)})
          console.log(`Removed ${removedCount} duplicate sessions`)
        } else {
          console.log("No duplicate sessions found")
        }
      },
    }),
    {
      name: "userRecords",
      storage: createJSONStorage(() => localforage),
      partialize: (state: UserRecordsStore) => ({
        invites: Array.from(state.invites.entries()).map(([id, invite]) => [
          id,
          invite.serialize(),
        ]),
        userRecords: Array.from(state.userRecords.entries()).map(([id, userRecord]) => [
          id,
          userRecord.serialize(),
        ]),
        lastSeen: Array.from(state.lastSeen.entries()),
        deviceId: state.deviceId,
      }),
      merge: (persistedState: unknown, currentState: UserRecordsStore) => {
        const state = (persistedState || {
          invites: [],
          userRecords: [],
          lastSeen: [],
          deviceId: "",
        }) as {
          invites: [string, string][]
          userRecords: [string, string][]
          lastSeen: [string, number][]
          deviceId: string
        }

        const newInvites = new Map<string, Invite>()
        state.invites?.forEach(([id, serializedInvite]) => {
          try {
            const invite = Invite.deserialize(serializedInvite)
            newInvites.set(id, invite)
          } catch (e) {
            console.warn("Failed to deserialize invite:", id, e)
          }
        })

        const newUserRecords = new Map<string, UserRecord>()
        state.userRecords?.forEach(([userPubKey, serializedUserRecord]) => {
          try {
            const userRecord = new UserRecord(userPubKey, userPubKey)
            userRecord.deserialize(serializedUserRecord)
            newUserRecords.set(userPubKey, userRecord)
          } catch (e) {
            console.warn("Failed to deserialize user record:", userPubKey, e)
          }
        })

        return {
          ...currentState,
          invites: newInvites,
          userRecords: newUserRecords,
          lastSeen: new Map<string, number>(state.lastSeen || []),
          deviceId: state.deviceId,
          deviceInviteListeners: new Map(),
          messageQueue: new Map(),
        }
      },
    }
  )
)
