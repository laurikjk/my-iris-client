import {Session} from "nostr-double-ratchet/src"
import {UnsignedEvent} from "nostr-tools"
import type {MessageType} from "@/pages/chats/message/Message"

export interface SessionData {
  session: Session
  userPubKey: string
  deviceId: string
}

export interface SessionsStoreState {
  sessions: Map<string, SessionData> // sessionId -> SessionData
  sessionListeners: Map<string, () => void> // sessionId -> unsubscribe function
  eventCallbacks: Set<(sessionId: string, event: MessageType) => void> // External event callbacks
}

export interface SessionsStoreActions {
  // Session management
  addSession: (
    sessionId: string,
    session: Session,
    userPubKey: string,
    deviceId: string
  ) => void
  removeSession: (sessionId: string) => void
  sendMessage: (sessionId: string, event: Partial<UnsignedEvent>) => Promise<void>

  // Event subscriptions
  onEvent: (callback: (sessionId: string, event: MessageType) => void) => () => void

  // Maintenance
  reset: () => void
  initializeSessionListeners: () => void
  processQueuedMessages: (sessionId: string) => void
}

export type SessionsStore = SessionsStoreState & SessionsStoreActions
