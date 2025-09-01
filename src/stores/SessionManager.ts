import {Invite, Session, serializeSessionState, deserializeSessionState, Rumor, CHAT_MESSAGE_KIND} from "nostr-double-ratchet/src"
import {generateSecretKey, getPublicKey, UnsignedEvent} from "nostr-tools"
import type {StorageAdapter} from "./StorageAdapter"
import type {UserRecord} from "./UserRecord"

export default class SessionManager {
  private ourIdentityKey: Uint8Array
  private deviceId: string
  private nostrSubscribe: (filter: any, onEvent: (event: any) => void) => () => void
  private nostrPublish: (event: unknown) => Promise<any>
  private storage: StorageAdapter
  
  private invite: any
  private sessions = new Map<string, Session>() // sessionId -> Session
  private userRecords = new Map<string, UserRecord>() // userPubKey -> UserRecord
  private inviteUnsubscribes = new Map<string, () => void>() // userPubKey -> unsubscribe function
  private internalSubscriptions: Array<(event: Rumor, fromUserPubKey: string) => void> = []
  private messageQueue = new Map<string, Array<{event: UnsignedEvent, resolve: (results: string[]) => void}>>()

  constructor(
    ourIdentityKey: Uint8Array,
    deviceId: string,
    nostrSubscribe: (filter: any, onEvent: (event: any) => void) => () => void,
    nostrPublish: (event: unknown) => Promise<any>,
    storage?: StorageAdapter
  ) {
    this.ourIdentityKey = ourIdentityKey
    this.deviceId = deviceId
    this.nostrSubscribe = nostrSubscribe
    this.nostrPublish = nostrPublish
    this.storage = storage || {
      get: async () => undefined,
      put: async () => {},
      del: async () => {},
      list: async () => [],
    }
    
    console.log("Initialising SessionManager")
  }

  async init() {
    // Load existing sessions from storage
    await this.loadSessions()

    const ourPublicKey = getPublicKey(this.ourIdentityKey)

    // 1. Create an invite for our device
    const inviteStorage = await this.storage.get<string>(`invite/${this.deviceId}`)
    let invite: any
    if (inviteStorage) {
      invite = Invite.deserialize(inviteStorage)
    } else {
      invite = Invite.createNew(ourPublicKey, this.deviceId)
      await this.storage
        .put(`invite/${this.deviceId}`, invite.serialize())
        .catch(() => {})
    }
    this.invite = invite

    // Publish our own invite
    console.log("Publishing our own invite", invite)
    const event = invite.getEvent()
    this.nostrPublish(event)
      .then((verifiedEvent) => {
        console.log("Invite published", verifiedEvent)
      })
      .catch((e) => console.error("Failed to publish our own invite", e))

    // 2b. Listen for acceptances of *our* invite and create sessions
    this.invite.listen(
      this.ourIdentityKey,
      this.nostrSubscribe,
      async (acceptanceEvent: any, sessionState: any) => {
        console.log("Acceptance event received", acceptanceEvent)
        try {
          const session = new Session(this.nostrSubscribe, sessionState)
          const deviceId = sessionState.deviceId || "unknown"
          const sessionId = `${ourPublicKey}:${deviceId}`
          this.sessions.set(sessionId, session)

          let userRecord = this.userRecords.get(ourPublicKey)
          if (!userRecord) {
            const {UserRecord} = await import("./UserRecord")
            userRecord = new UserRecord(ourPublicKey, ourPublicKey)
            this.userRecords.set(ourPublicKey, userRecord)
          }
          userRecord.upsertSession(deviceId, sessionId)
          this.saveSession(ourPublicKey, deviceId, session)

          session.onEvent((_event: Rumor) => {
            this.internalSubscriptions.forEach((cb) => cb(_event, ourPublicKey))
          })
        } catch {
          /* ignore errors */
        }
      }
    )

    // 3. Subscribe to our own invites from other devices
    Invite.fromUser(ourPublicKey, this.nostrSubscribe, async (invite) => {
      try {
        const inviteDeviceId = invite["deviceId"] || "unknown"
        if (!inviteDeviceId || inviteDeviceId === this.deviceId) {
          return
        }

        const existingRecord = this.userRecords.get(ourPublicKey)
        if (existingRecord?.getActiveSessionId(inviteDeviceId)) {
          return
        }

        const {session, event} = await invite.accept(
          this.nostrSubscribe,
          ourPublicKey,
          this.ourIdentityKey
        )
        this.nostrPublish(event)?.catch(() => {})

        const sessionId = `${ourPublicKey}:${inviteDeviceId}`
        this.sessions.set(sessionId, session)
        this.saveSession(ourPublicKey, inviteDeviceId, session)

        let userRecord = this.userRecords.get(ourPublicKey)
        if (!userRecord) {
          const {UserRecord} = await import("./UserRecord")
          userRecord = new UserRecord(ourPublicKey, ourPublicKey)
          this.userRecords.set(ourPublicKey, userRecord)
        }
        const deviceId = invite["deviceId"] || "unknown"
        userRecord.upsertSession(deviceId, sessionId)
        this.saveSession(ourPublicKey, deviceId, session)

        session.onEvent((_event: Rumor) => {
          this.internalSubscriptions.forEach((cb) => cb(_event, ourPublicKey))
        })
      } catch (err) {
        console.error("Own-invite accept failed", err)
      }
    })

    await this.nostrPublish(this.invite.getEvent()).catch(() => {})
  }

  private async loadSessions() {
    const base = "session/"
    const keys = await this.storage.list(base)
    for (const key of keys) {
      const rest = key.substring(base.length)
      const idx = rest.indexOf("/")
      if (idx === -1) continue
      const ownerPubKey = rest.substring(0, idx)
      const deviceId = rest.substring(idx + 1) || "unknown"

      const data = await this.storage.get<string>(key)
      if (!data) continue
      try {
        const state = deserializeSessionState(data)
        const session = new Session(this.nostrSubscribe, state)

        const sessionId = `${ownerPubKey}:${deviceId}`
        this.sessions.set(sessionId, session)

        let userRecord = this.userRecords.get(ownerPubKey)
        if (!userRecord) {
          const {UserRecord} = await import("./UserRecord")
          userRecord = new UserRecord(ownerPubKey, ownerPubKey)
          this.userRecords.set(ownerPubKey, userRecord)
        }
        userRecord.upsertSession(deviceId, sessionId)

        // Set up message listener
        session.onEvent((_event: Rumor) => {
          this.internalSubscriptions.forEach((callback) => callback(_event, ownerPubKey))
        })
      } catch (e) {
        console.log("Failed to restore session", key, e)
        // Clean up invalid session data
        await this.storage.del(key).catch(() => {})
      }
    }
  }

  private async saveSession(userPubKey: string, deviceId: string, session: Session) {
    const key = `session/${userPubKey}/${deviceId}`
    const serialized = serializeSessionState(session.state)
    await this.storage.put(key, serialized).catch((e) => {
      console.error("Failed to save session", key, e)
    })
  }

  async sendText(recipientIdentityKey: string, text: string): Promise<string[]> {
    const event: UnsignedEvent = {
      kind: CHAT_MESSAGE_KIND,
      content: text,
      tags: [],
      created_at: Math.floor(Date.now() / 1000)
    }
    return this.sendEvent(recipientIdentityKey, event)
  }

  async sendEvent(recipientIdentityKey: string, event: UnsignedEvent): Promise<string[]> {
    // Emit the event to our own listeners
    this.internalSubscriptions.forEach((callback) => callback(event as Rumor, getPublicKey(this.ourIdentityKey)))

    const results: string[] = []
    const publishPromises: Promise<void>[] = []

    // Send to recipient's devices
    const userRecord = this.userRecords.get(recipientIdentityKey)
    if (!userRecord) {
      return new Promise<string[]>((resolve) => {
        if (!this.messageQueue.has(recipientIdentityKey)) {
          this.messageQueue.set(recipientIdentityKey, [])
        }
        this.messageQueue.get(recipientIdentityKey)!.push({event, resolve})
        this.listenToUser(recipientIdentityKey)
      })
    }

    const activeSessionIds = userRecord.getActiveSessionIds()
    const sendableSessions: Session[] = []
    for (const sessionId of activeSessionIds) {
      const session = this.sessions.get(sessionId)
      if (
        session &&
        session.state?.theirNextNostrPublicKey &&
        session.state?.ourCurrentNostrKey
      ) {
        sendableSessions.push(session)
      }
    }

    if (sendableSessions.length === 0) {
      return new Promise<string[]>((resolve) => {
        if (!this.messageQueue.has(recipientIdentityKey)) {
          this.messageQueue.set(recipientIdentityKey, [])
        }
        this.messageQueue.get(recipientIdentityKey)!.push({event, resolve})
      })
    }

    // Send to each active session
    for (const session of sendableSessions) {
      const {event: encryptedEvent} = session.sendEvent(event)
      results.push(encryptedEvent.id || "")
      publishPromises.push(
        this.nostrPublish(encryptedEvent)
          .then(() => {})
          .catch(() => {})
      )
    }

    // Send to our own devices
    const ourPublicKey = getPublicKey(this.ourIdentityKey)
    const ownUserRecord = this.userRecords.get(ourPublicKey)
    if (ownUserRecord) {
      const ownActiveSessionIds = ownUserRecord.getActiveSessionIds()
      for (const sessionId of ownActiveSessionIds) {
        const session = this.sessions.get(sessionId)
        if (
          session &&
          session.state?.theirNextNostrPublicKey &&
          session.state?.ourCurrentNostrKey
        ) {
          const {event: encryptedEvent} = session.sendEvent(event)
          results.push(encryptedEvent.id || "")
          publishPromises.push(
            this.nostrPublish(encryptedEvent)
              .then(() => {})
              .catch(() => {})
          )
        }
      }
    }

    // Ensure all publish operations settled before returning
    if (publishPromises.length > 0) {
      await Promise.all(publishPromises)
    }

    return results
  }

  listenToUser(userPubkey: string) {
    // Don't subscribe multiple times to the same user
    if (this.inviteUnsubscribes.has(userPubkey)) return

    const unsubscribe = Invite.fromUser(
      userPubkey,
      this.nostrSubscribe,
      async (_invite) => {
        try {
          const deviceId =
            _invite instanceof Invite && _invite.deviceId ? _invite.deviceId : "unknown"

          const userRecord = this.userRecords.get(userPubkey)
          if (userRecord && userRecord.getActiveSessionId(deviceId)) {
            return // Already have session with this device
          }

          const {session, event} = await _invite.accept(
            this.nostrSubscribe,
            getPublicKey(this.ourIdentityKey),
            this.ourIdentityKey
          )
          this.nostrPublish(event)?.catch(() => {})

          // Store the new session
          const sessionId = `${userPubkey}:${deviceId}`
          this.sessions.set(sessionId, session)

          let currentUserRecord = this.userRecords.get(userPubkey)
          if (!currentUserRecord) {
            const {UserRecord} = await import("./UserRecord")
            currentUserRecord = new UserRecord(userPubkey, userPubkey)
            this.userRecords.set(userPubkey, currentUserRecord)
          }
          currentUserRecord.upsertSession(deviceId, sessionId)
          this.saveSession(userPubkey, deviceId, session)

          // Register all existing callbacks on the new session
          session.onEvent((_event: Rumor) => {
            this.internalSubscriptions.forEach((callback) => callback(_event, userPubkey))
          })

          const queuedMessages = this.messageQueue.get(userPubkey)
          if (queuedMessages && queuedMessages.length > 0) {
            setTimeout(async () => {
              const currentQueuedMessages = this.messageQueue.get(userPubkey)
              if (currentQueuedMessages && currentQueuedMessages.length > 0) {
                const messagesToProcess = [...currentQueuedMessages]
                this.messageQueue.delete(userPubkey)

                for (const {event: queuedEvent, resolve} of messagesToProcess) {
                  const results = await this.sendEvent(userPubkey, queuedEvent)
                  resolve(results)
                }
              }
            }, 1000) // Increased delay for CI compatibility
          }

          // Return the event to be published
          return event
        } catch {
          // ignore errors
        }
      }
    )

    this.inviteUnsubscribes.set(userPubkey, unsubscribe)
  }

  stopListeningToUser(userPubkey: string) {
    const unsubscribe = this.inviteUnsubscribes.get(userPubkey)
    if (unsubscribe) {
      unsubscribe()
      this.inviteUnsubscribes.delete(userPubkey)
    }
  }

  onEvent(callback: (event: Rumor, fromUserPubKey: string) => void): () => void {
    this.internalSubscriptions.push(callback)
    return () => {
      const index = this.internalSubscriptions.indexOf(callback)
      if (index > -1) {
        this.internalSubscriptions.splice(index, 1)
      }
    }
  }

  close() {
    // Unsubscribe from all invites
    for (const unsubscribe of this.inviteUnsubscribes.values()) {
      unsubscribe()
    }
    this.inviteUnsubscribes.clear()

    // Close all sessions
    for (const session of this.sessions.values()) {
      session.close()
    }
    this.sessions.clear()

    // Clear all callbacks
    this.internalSubscriptions = []
  }
}