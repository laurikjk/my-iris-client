/* eslint-disable @typescript-eslint/no-explicit-any */
import {StorageAdapter} from "nostr-double-ratchet/src/StorageAdapter"
import SessionManager from "nostr-double-ratchet/src/SessionManager"
import {usePrivateChatsStore} from "../stores/privateChats"
import {VerifiedEvent, Filter} from "nostr-tools"
import {useEventsStore} from "../stores/events"
import {useUserStore} from "../stores/user"
import localforage from "localforage"
import {ndk} from "@/utils/ndk"

// localforage storage adapter
const storage: StorageAdapter = {
  get: async (key) => {
    return (await localforage.getItem(key)) ?? undefined
  },
  put: async (key, value) => {
    await localforage.setItem(key, value)
  },
  del: async (key) => {
    await localforage.removeItem(key)
  },
  list: async (prefix) => {
    const keys: string[] = []
    await localforage.iterate((_value, key) => {
      if (!prefix || key.startsWith(prefix)) keys.push(key)
    })
    return keys
  },
}

// Nostr subscribe helper for SessionManager
const makeSubscribe = () => (filter: Filter, onEvent: (event: VerifiedEvent) => void) => {
  const sub = ndk().subscribe(filter)
  sub.on("event", (e) => onEvent(e as unknown as VerifiedEvent))
  return () => sub.stop()
}

const makePublish = () => (event: any) => {
  try {
    return ndk().publish(event) as unknown as Promise<void>
  } catch (e) {
    console.warn("Failed to publish event", e)
    return undefined
  }
}
// State management
let manager: SessionManager | undefined
let messageCallbacks: Array<(publicKey: string, event: any) => void> = []

const getDeviceId = (): string => {
  const stored = window.localStorage.getItem("deviceId")
  if (stored) return stored
  const newId = `web-${crypto.randomUUID()}`
  window.localStorage.setItem("deviceId", newId)
  return newId
}

/**
 * Initialize the session manager with user's identity key and device ID
 */
async function initializeManager(identityKey: Uint8Array, deviceId: string): Promise<void> {
  if (manager) return // already initialized

  const subscribe = makeSubscribe()
  const publish = makePublish()

  // Cast to any to avoid potential type mismatches arising from duplicate nostr-tools versions
  manager = new SessionManager(
    identityKey,
    deviceId,
    subscribe as unknown as any,
    publish as unknown as any,
    storage
  )

  // Ensure internal async init finishes
  console.log("SessionManager: Starting init...")
  await manager.init()
  console.log("SessionManager: Init completed")

  // Test if manager has expected methods
  console.log(
    "SessionManager methods:",
    Object.getOwnPropertyNames(Object.getPrototypeOf(manager))
  )
  console.log("Manager onEvent type:", typeof manager.onEvent)

  // Listen to events and handle new contacts
  // Note: SessionManager.onEvent only provides Rumor, not sender info
  // We need to track sender through session management
  manager.onEvent((rumor: any) => {
    console.log("Received rumor from session manager:", rumor)

    // The rumor.pubkey is a dummy value, we need to get sender info differently
    // For now, log the rumor structure to understand what data we have
    console.log("Rumor structure:", {
      id: rumor.id,
      content: rumor.content,
      kind: rumor.kind,
      created_at: rumor.created_at,
      pubkey: rumor.pubkey,
      tags: rumor.tags,
    })

    // TODO: Need to implement proper sender tracking
    // The SessionManager doesn't provide sender info directly
    // We may need to use individual session callbacks or track sessions separately
    // Notify message callbacks (without proper sender for now)
    messageCallbacks.forEach((callback) => {
      callback("unknown-sender", rumor)
    })
  })
}

/**
 * Get the underlying SessionManager instance, initializing if needed
 */
async function ensureManager(): Promise<SessionManager | undefined> {
  if (manager) return manager

  // Try to initialize if keys are present
  const publicKey = useUserStore.getState().publicKey
  if (!publicKey) return undefined

  const {hexToBytes} = await import("@noble/hashes/utils")
  const deviceId = getDeviceId()

  await initializeManager(hexToBytes(publicKey), deviceId)
  return manager
}

/**
 * Initialize a chat with a specific public key
 * Adds the contact to privateChats and starts listening for their messages
 */
export async function initializeChat(publicKeyHex: string): Promise<void> {
  const sessionManager = await ensureManager()
  if (!sessionManager) {
    console.warn("SessionManager not available")
    return
  }

  // Add to privateChats store if not already there
  const {hasChat, addChat} = usePrivateChatsStore.getState()
  if (!hasChat(publicKeyHex)) {
    addChat(publicKeyHex)
  }

  // Start listening for invites from this user
  // This will automatically create a session when the user publishes an invite
  sessionManager.listenToUser(publicKeyHex)
}

/**
 * Send a message to a specific public key
 */
export async function sendMessage(
  publicKey: string,
  content: string,
  replyToId?: string,
  isReaction = false
): Promise<void> {
  const sessionManager = await ensureManager()
  if (!sessionManager) {
    throw new Error("SessionManager not available")
  }

  console.log(
    "SessionManager: Attempting to send message to",
    publicKey,
    "content:",
    content
  )

  try {
    let messageToStore: any
    let events: any[] = []

    // Use the library's sendText method for simple text messages
    if (!isReaction && !replyToId) {
      console.log("SessionManager: Calling sendText with", publicKey, content)
      events = await (sessionManager as any).sendText(publicKey, content)
      console.log("SessionManager: sendText returned events:", events)

      // Create a message object to store in our events
      const myPubKey = useUserStore.getState().publicKey
      messageToStore = {
        id: crypto.randomUUID(),
        content,
        kind: 1059,
        created_at: Math.floor(Date.now() / 1000),
        pubkey: myPubKey || "",
        sender: "user" as const, // Mark as sent by us
        tags: [["ms", Date.now().toString()]],
      }
    } else {
      // For reactions or replies, use sendEvent with custom format
      const event = {
        content,
        kind: isReaction ? 7 : 1059, // 7 for reactions, 1059 for chat messages
        tags: [...(replyToId ? [["e", replyToId]] : []), ["ms", Date.now().toString()]],
      }

      events = await (sessionManager as any).sendEvent(publicKey, event)

      // Create a message object to store in our events
      const myPubKey = useUserStore.getState().publicKey
      messageToStore = {
        id: crypto.randomUUID(),
        content,
        kind: event.kind,
        created_at: Math.floor(Date.now() / 1000),
        pubkey: myPubKey || "",
        sender: "user" as const, // Mark as sent by us
        tags: event.tags,
      }
    }

    // If library returned no events but didn't error, the session might not be established yet
    if (events.length === 0) {
      console.log("SessionManager: No events returned, ensuring listening to user")
      sessionManager.listenToUser(publicKey)
    }

    // Store our sent message in the events store so it appears in the chat
    if (messageToStore) {
      await useEventsStore.getState().upsert(publicKey, messageToStore)
    }
  } catch (error) {
    console.error("SessionManager: Failed to send message:", error)

    // Store the message locally even if sending failed
    const myPubKey = useUserStore.getState().publicKey
    const messageToStore = {
      id: crypto.randomUUID(),
      content,
      kind: isReaction ? 7 : 1059,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: myPubKey || "",
      sender: "user" as const,
      tags: replyToId
        ? [
            ["e", replyToId],
            ["ms", Date.now().toString()],
          ]
        : [["ms", Date.now().toString()]],
    }
    await useEventsStore.getState().upsert(publicKey, messageToStore)
    throw error
  }
}

/**
 * Register a callback for incoming messages
 */
export function onMessage(callback: (publicKey: string, event: any) => void): () => void {
  messageCallbacks.push(callback)

  // Return unsubscribe function
  return () => {
    const index = messageCallbacks.indexOf(callback)
    if (index > -1) {
      messageCallbacks.splice(index, 1)
    }
  }
}

