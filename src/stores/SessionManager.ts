import {UserRecord} from "./UserRecord"
import {getPublicKey} from "nostr-tools"
import {StorageAdapter, InMemoryStorageAdapter} from "./StorageAdapter"
import {
  CHAT_MESSAGE_KIND,
  deserializeSessionState,
  Invite,
  NostrPublish,
  NostrSubscribe,
  Rumor,
  serializeSessionState,
  Session,
  Unsubscribe,
} from "nostr-double-ratchet/src"

export type OnEventCallback = (event: Rumor, from: string) => void

export default class SessionManager {
  private userRecords: Map<string, UserRecord> = new Map()
  private sessions: Map<string, Session> = new Map() // sessionId -> Session
  private nostrSubscribe: NostrSubscribe
  private nostrPublish: NostrPublish
  private ourIdentityKey: Uint8Array
  private inviteUnsubscribes: Map<string, Unsubscribe> = new Map()
  private deviceId: string
  private invite?: Invite
  private storage: StorageAdapter
  private messageQueue: Map<
    string,
    Array<{event: Partial<Rumor>; resolve: (results: string[]) => void}>
  > = new Map()

  constructor(
    ourIdentityKey: Uint8Array,
    deviceId: string,
    nostrSubscribe: NostrSubscribe,
    nostrPublish: NostrPublish,
    storage: StorageAdapter = new InMemoryStorageAdapter()
  ) {
    this.userRecords = new Map()
    this.sessions = new Map()
    this.nostrSubscribe = nostrSubscribe
    this.nostrPublish = nostrPublish
    this.ourIdentityKey = ourIdentityKey
    this.deviceId = deviceId
    this.storage = storage

    // Kick off initialisation in background for backwards compatibility
    // Users that need to wait can call await manager.init()
    this.init()
  }

  /**
   * Perform asynchronous initialisation steps: create (or load) our invite,
   * publish it, hydrate sessions from storage and subscribe to new invites.
   * Can be awaited by callers that need deterministic readiness.
   */
  public async init(): Promise<void> {
    console.log("Initialising SessionManager")

    const ourPublicKey = getPublicKey(this.ourIdentityKey)

    // 1. Hydrate existing sessions
    await this.loadSessions()

    // 2. Create or load our own invite
    let invite: Invite | undefined
    try {
      const stored = await this.storage.get<string>(`invite/${this.deviceId}`)
      if (stored) {
        invite = Invite.deserialize(stored)
      }
    } catch {
      /* ignore malformed */
    }

    if (!invite) {
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
      (session, inviteePubkey) => {
        if (!inviteePubkey) return

        const targetUserKey = inviteePubkey

        try {
          let userRecord = this.userRecords.get(targetUserKey)
          if (!userRecord) {
            userRecord = new UserRecord(targetUserKey, targetUserKey)
            this.userRecords.set(targetUserKey, userRecord)
          }

          const deviceKey = session.name || "unknown"
          const sessionId = `${targetUserKey}:${deviceKey}`

          // Store session
          this.sessions.set(sessionId, session)
          userRecord.upsertSession(deviceKey, sessionId)
          this.saveSession(targetUserKey, deviceKey, session)

          session.onEvent((_event: Rumor) => {
            this.internalSubscriptions.forEach((cb) => cb(_event, targetUserKey))
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
          userRecord = new UserRecord(ownerPubKey, ownerPubKey)
          this.userRecords.set(ownerPubKey, userRecord)
        }
        userRecord.upsertSession(deviceId, sessionId)
        this.saveSession(ownerPubKey, deviceId, session)

        session.onEvent((_event: Rumor) => {
          this.internalSubscriptions.forEach((cb) => cb(_event, ownerPubKey))
        })
      } catch {
        // corrupted entry — ignore
      }
    }
  }

  private async saveSession(ownerPubKey: string, deviceId: string, session: Session) {
    try {
      const key = `session/${ownerPubKey}/${deviceId}`
      await this.storage.put(key, serializeSessionState(session.state))
    } catch {
      /* ignore */
    }
  }

  getDeviceId(): string {
    return this.deviceId
  }

  getInvite(): Invite {
    if (!this.invite) {
      throw new Error("SessionManager not initialised yet")
    }
    return this.invite
  }

  async sendText(recipientIdentityKey: string, text: string) {
    const event = {
      kind: CHAT_MESSAGE_KIND,
      content: text,
    }
    return await this.sendEvent(recipientIdentityKey, event)
  }

  async sendEvent(recipientIdentityKey: string, event: Partial<Rumor>) {
    console.log("Sending event to", recipientIdentityKey, event)
    // Immediately notify local subscribers so that UI can render sent message optimistically
    this.internalSubscriptions.forEach((cb) => cb(event as Rumor, recipientIdentityKey))

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
        this.listenToUser(recipientIdentityKey)
      })
    }

    // Send to all sendable sessions with recipient
    for (const session of sendableSessions) {
      const {event: encryptedEvent} = session.sendEvent(event)
      results.push(encryptedEvent.id || "")
      publishPromises.push(
        this.nostrPublish(encryptedEvent)
          .then(() => {})
          .catch(() => {})
      )
    }

    // Send to our own devices (for multi-device sync)
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

  // Update onEvent to include internalSubscriptions management
  private internalSubscriptions: Set<OnEventCallback> = new Set()

  onEvent(callback: OnEventCallback) {
    this.internalSubscriptions.add(callback)

    // Subscribe to existing sessions
    for (const [pubkey, userRecord] of this.userRecords.entries()) {
      for (const sessionId of userRecord.getActiveSessionIds()) {
        const session = this.sessions.get(sessionId)
        if (session) {
          session.onEvent((event: Rumor) => {
            callback(event, pubkey)
          })
        }
      }
    }

    // Return unsubscribe function
    return () => {
      this.internalSubscriptions.delete(callback)
    }
  }

  close() {
    // Clean up all subscriptions
    for (const unsubscribe of this.inviteUnsubscribes.values()) {
      unsubscribe()
    }
    this.inviteUnsubscribes.clear()

    // Close all sessions
    for (const session of this.sessions.values()) {
      session.close()
    }
    this.sessions.clear()
    this.userRecords.clear()
    this.internalSubscriptions.clear()
  }

  /**
   * Accept an invite as our own device, persist the session, and publish the acceptance event.
   * Used for multi-device flows where a user adds a new device.
   */
  public async acceptOwnInvite(invite: Invite) {
    const ourPublicKey = getPublicKey(this.ourIdentityKey)
    const {session, event} = await invite.accept(
      this.nostrSubscribe,
      ourPublicKey,
      this.ourIdentityKey
    )

    const deviceId = session.name || "unknown"
    const sessionId = `${ourPublicKey}:${deviceId}`
    this.sessions.set(sessionId, session)

    let userRecord = this.userRecords.get(ourPublicKey)
    if (!userRecord) {
      userRecord = new UserRecord(ourPublicKey, ourPublicKey)
      this.userRecords.set(ourPublicKey, userRecord)
    }
    userRecord.upsertSession(deviceId, sessionId)
    await this.saveSession(ourPublicKey, deviceId, session)
    this.nostrPublish(event)?.catch(() => {})
  }
}
