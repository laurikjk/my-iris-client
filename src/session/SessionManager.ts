import {
  NostrSubscribe,
  NostrPublish,
  Rumor,
  Unsubscribe,
  serializeSessionState,
  deserializeSessionState,
  Invite,
  Session,
} from "nostr-double-ratchet"
import {StorageAdapter, InMemoryStorageAdapter} from "./StorageAdapter"
import {getPublicKey} from "nostr-tools"
import {KIND_CHAT_MESSAGE} from "../utils/constants"

export type OnEventCallback = (event: Rumor, from: string) => void

// Pure data interfaces - no behavior, just state
interface DeviceRecord {
  readonly deviceId: string
  readonly userId: string
  readonly publicKey: string
  readonly activeSession?: Session
  readonly inactiveSessions: Session[]
  readonly isStale: boolean
  readonly staleTimestamp?: number
  readonly lastActivity?: number
  readonly createdAt: number
}

interface UserRecord {
  readonly userId: string
  readonly devices: Map<string, DeviceRecord>
  readonly isStale: boolean
  readonly staleTimestamp?: number
  readonly createdAt: number
  readonly lastActivity?: number
}

interface SubscriptionRecord {
  readonly id: string
  readonly type: "invite" | "session" | "self-invite"
  readonly userId?: string
  readonly deviceId?: string
  readonly unsubscribe: Unsubscribe
  readonly createdAt: number
  readonly metadata?: Record<string, unknown>
}

class SubscriptionManager {
  private subscriptions: Map<string, SubscriptionRecord> = new Map()

  subscribe(
    id: string,
    unsubscribe: Unsubscribe,
    type: SubscriptionRecord["type"],
    metadata?: {userId?: string; deviceId?: string; [key: string]: unknown}
  ): void {
    this.unsubscribe(id)

    this.subscriptions.set(id, {
      id,
      type,
      unsubscribe,
      createdAt: Date.now(),
      ...metadata,
    })
  }

  unsubscribe(id: string): boolean {
    const subscription = this.subscriptions.get(id)
    if (!subscription) return false

    subscription.unsubscribe()
    return this.subscriptions.delete(id)
  }

  unsubscribeByUser(userId: string): number {
    let count = 0
    for (const [id, sub] of this.subscriptions) {
      if (sub.userId === userId) {
        sub.unsubscribe()
        this.subscriptions.delete(id)
        count++
      }
    }
    return count
  }

  unsubscribeByDevice(userId: string, deviceId: string): number {
    let count = 0
    for (const [id, sub] of this.subscriptions) {
      if (sub.userId === userId && sub.deviceId === deviceId) {
        sub.unsubscribe()
        this.subscriptions.delete(id)
        count++
      }
    }
    return count
  }

  close(): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.unsubscribe()
    }
    this.subscriptions.clear()
  }

  debugInfo(): string {
    const byType = new Map<string, number>()
    for (const sub of this.subscriptions.values()) {
      byType.set(sub.type, (byType.get(sub.type) || 0) + 1)
    }
    return `Subscriptions: ${this.subscriptions.size} total, by type: ${JSON.stringify(Object.fromEntries(byType))}`
  }
}

export default class SessionManager {
  private userRecords: Map<string, UserRecord> = new Map()
  private subscriptionManager = new SubscriptionManager()
  private nostrSubscribe: NostrSubscribe
  private nostrPublish: NostrPublish
  private ourIdentityKey: Uint8Array
  private deviceId: string
  private invite?: Invite
  private storage: StorageAdapter
  private messageQueue: Map<
    string,
    Array<{event: Partial<Rumor>; resolve: (results: unknown[]) => void}>
  > = new Map()

  constructor(
    ourIdentityKey: Uint8Array,
    deviceId: string,
    nostrSubscribe: NostrSubscribe,
    nostrPublish: NostrPublish,
    storage?: StorageAdapter
  ) {
    this.userRecords = new Map()
    this.nostrSubscribe = nostrSubscribe
    this.nostrPublish = nostrPublish
    this.ourIdentityKey = ourIdentityKey
    this.deviceId = deviceId
    this.storage = storage || new InMemoryStorageAdapter()
  }

  private _initialised = false

  private async _processReceivedMessage(
    session: Session,
    event: Rumor,
    pubkey: string,
    deviceId: string
  ): Promise<void> {
    // 1. Save session state FIRST (state already advanced by decryption)
    await this.saveSession(pubkey, deviceId, session)

    // 2. Then notify callbacks
    this.internalSubscriptions.forEach((cb) => cb(event, pubkey))
  }

  /**
   * Perform asynchronous initialisation steps: create (or load) our invite,
   * publish it, hydrate sessions from storage and subscribe to new invites.
   * Can be awaited by callers that need deterministic readiness.
   */
  public async init(): Promise<void> {
    if (!this._initialised) {
      await this._init()
      this._initialised = true
      return
    }
  }

  private async _init(): Promise<void> {
    const ourPublicKey = getPublicKey(this.ourIdentityKey)

    // 1. Hydrate existing sessions (placeholder for future implementation)
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
            userRecord = {
              userId: targetUserKey,
              devices: new Map(),
              isStale: false,
              createdAt: Date.now(),
              lastActivity: Date.now(),
            }
            this.userRecords.set(targetUserKey, userRecord)
          }

          const deviceKey = session.name || "unknown"

          // Ensure session name matches deviceId
          session.name = deviceKey

          // Inline upsertSession logic
          const device = userRecord.devices.get(deviceKey)
          const updatedInactive = device?.activeSession
            ? [device.activeSession, ...(device.inactiveSessions || [])]
            : device?.inactiveSessions || []

          const updatedDevice: DeviceRecord = {
            deviceId: deviceKey,
            userId: targetUserKey,
            publicKey: session.state?.theirNextNostrPublicKey || "",
            activeSession: session,
            inactiveSessions: updatedInactive,
            isStale: false,
            createdAt: device?.createdAt || Date.now(),
            lastActivity: Date.now(),
          }

          const updatedDevices = new Map(userRecord.devices)
          updatedDevices.set(deviceKey, updatedDevice)

          this.userRecords.set(targetUserKey, {
            ...userRecord,
            devices: updatedDevices,
            lastActivity: Date.now(),
          })

          this.saveSession(targetUserKey, deviceKey, session)

          // Set up session subscription
          const sessionSubscriptionId = `session:${targetUserKey}:${deviceKey}`
          this.subscriptionManager.unsubscribeByDevice(targetUserKey, deviceKey)

          const sessionUnsubscribe = session.onEvent((_event: Rumor) => {
            // Process message immediately, but schedule saving for later
            // This avoids circular dependency with the operation queue
            Promise.resolve().then(async () => {
              try {
                await this._processReceivedMessage(
                  session,
                  _event,
                  targetUserKey,
                  deviceKey
                )
              } catch (error) {
                console.error("Error processing received message:", error)
              }
            })
          })

          this.subscriptionManager.subscribe(
            sessionSubscriptionId,
            sessionUnsubscribe,
            "session",
            {userId: targetUserKey, deviceId: deviceKey}
          )
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
        if (existingRecord && !existingRecord.isStale) {
          // Inline getActiveSessions logic
          let hasExistingSession = false
          for (const device of existingRecord.devices.values()) {
            if (
              !device.isStale &&
              device.activeSession &&
              device.activeSession.name === inviteDeviceId
            ) {
              hasExistingSession = true
              break
            }
          }
          if (hasExistingSession) {
            return
          }
        }

        const {session, event} = await invite.accept(
          this.nostrSubscribe,
          ourPublicKey,
          this.ourIdentityKey
        )
        this.nostrPublish(event)

        this.saveSession(ourPublicKey, inviteDeviceId, session)

        let userRecord = this.userRecords.get(ourPublicKey)
        if (!userRecord) {
          userRecord = {
            userId: ourPublicKey,
            devices: new Map(),
            isStale: false,
            createdAt: Date.now(),
            lastActivity: Date.now(),
          }
          this.userRecords.set(ourPublicKey, userRecord)
        }
        const deviceId = invite["deviceId"] || "unknown"

        // Ensure session name matches deviceId
        session.name = deviceId

        // Inline upsertSession logic
        const device = userRecord.devices.get(deviceId)
        const updatedInactive = device?.activeSession
          ? [device.activeSession, ...(device.inactiveSessions || [])]
          : device?.inactiveSessions || []

        const updatedDevice: DeviceRecord = {
          deviceId: deviceId,
          userId: ourPublicKey,
          publicKey: session.state?.theirNextNostrPublicKey || "",
          activeSession: session,
          inactiveSessions: updatedInactive,
          isStale: false,
          createdAt: device?.createdAt || Date.now(),
          lastActivity: Date.now(),
        }

        const updatedDevices = new Map(userRecord.devices)
        updatedDevices.set(deviceId, updatedDevice)

        this.userRecords.set(ourPublicKey, {
          ...userRecord,
          devices: updatedDevices,
          lastActivity: Date.now(),
        })

        this.saveSession(ourPublicKey, deviceId, session)

        // Set up session subscription
        const sessionSubscriptionId = `session:${ourPublicKey}:${deviceId}`
        this.subscriptionManager.unsubscribeByDevice(ourPublicKey, deviceId)

        const sessionUnsubscribe = session.onEvent((_event: Rumor) => {
          // Process message immediately, but schedule saving for later
          // This avoids circular dependency with the operation queue
          Promise.resolve().then(async () => {
            try {
              await this._processReceivedMessage(session, _event, ourPublicKey, deviceId)
            } catch (error) {
              console.error("Error processing received message:", error)
            }
          })
        })

        this.subscriptionManager.subscribe(
          sessionSubscriptionId,
          sessionUnsubscribe,
          "session",
          {userId: ourPublicKey, deviceId: deviceId}
        )
      } catch (err) {
        console.error("Own-invite accept failed", err)
      }
    })
  }

  private async loadSessions() {
    const base = "session/"
    const keys = await this.storage.list(base)
    const ourPublicKey = getPublicKey(this.ourIdentityKey)
    const uniqueUsers = new Set<string>()

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

        let userRecord = this.userRecords.get(ownerPubKey)
        if (!userRecord) {
          userRecord = {
            userId: ownerPubKey,
            devices: new Map(),
            isStale: false,
            createdAt: Date.now(),
            lastActivity: Date.now(),
          }
          this.userRecords.set(ownerPubKey, userRecord)
        }
        console.log(`Loading session for ${ownerPubKey} with deviceId: ${deviceId}`)

        // Ensure session name matches deviceId
        session.name = deviceId

        // Inline upsertSession logic
        const device = userRecord.devices.get(deviceId)
        const updatedInactive = device?.activeSession
          ? [device.activeSession, ...(device.inactiveSessions || [])]
          : device?.inactiveSessions || []

        const updatedDevice: DeviceRecord = {
          deviceId: deviceId,
          userId: ownerPubKey,
          publicKey: session.state?.theirNextNostrPublicKey || "",
          activeSession: session,
          inactiveSessions: updatedInactive,
          isStale: false,
          createdAt: device?.createdAt || Date.now(),
          lastActivity: Date.now(),
        }

        const updatedDevices = new Map(userRecord.devices)
        updatedDevices.set(deviceId, updatedDevice)

        this.userRecords.set(ownerPubKey, {
          ...userRecord,
          devices: updatedDevices,
          lastActivity: Date.now(),
        })

        // Don't save again - we just loaded from storage

        // Set up session subscription
        const sessionSubscriptionId = `session:${ownerPubKey}:${deviceId}`
        this.subscriptionManager.unsubscribeByDevice(ownerPubKey, deviceId)

        const sessionUnsubscribe = session.onEvent((_event: Rumor) => {
          // Process message immediately, but schedule saving for later
          // This avoids circular dependency with the operation queue
          Promise.resolve().then(async () => {
            try {
              await this._processReceivedMessage(session, _event, ownerPubKey, deviceId)
            } catch (error) {
              console.error("Error processing received message:", error)
            }
          })
        })

        this.subscriptionManager.subscribe(
          sessionSubscriptionId,
          sessionUnsubscribe,
          "session",
          {userId: ownerPubKey, deviceId: deviceId}
        )

        // Track unique users to start listening for new invites/messages
        if (ownerPubKey !== ourPublicKey) {
          uniqueUsers.add(ownerPubKey)
        }
      } catch {
        // corrupted entry — ignore
      }
    }

    // Set up invite subscriptions for all loaded users
    for (const userPubKey of uniqueUsers) {
      this.setupUserInviteSubscription(userPubKey)
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
      kind: KIND_CHAT_MESSAGE,
      content: text,
    }
    return await this.sendEvent(recipientIdentityKey, event)
  }

  async sendEvent(
    recipientIdentityKey: string,
    event: Partial<Rumor>
  ): Promise<unknown[]> {
    return await this._sendEvent(recipientIdentityKey, event)
  }

  private async _sendEvent(
    recipientIdentityKey: string,
    event: Partial<Rumor>
  ): Promise<unknown[]> {
    console.log("Sending event to", recipientIdentityKey, event)
    this.internalSubscriptions.forEach((cb) => cb(event as Rumor, recipientIdentityKey))

    const results = []
    const publishPromises: Promise<unknown>[] = []

    const userRecord = this.userRecords.get(recipientIdentityKey)
    if (!userRecord) {
      return new Promise<unknown[]>((resolve) => {
        if (!this.messageQueue.has(recipientIdentityKey)) {
          this.messageQueue.set(recipientIdentityKey, [])
        }
        this.messageQueue.get(recipientIdentityKey)!.push({event, resolve})
        this.listenToUser(recipientIdentityKey)
      })
    }

    // Inline getActiveSessions logic
    const activeSessions: Session[] = []
    if (!userRecord.isStale) {
      for (const device of userRecord.devices.values()) {
        if (!device.isStale && device.activeSession) {
          activeSessions.push(device.activeSession)
        }
      }
    }
    const sendableSessions = activeSessions.filter(
      (s) => !!(s.state?.theirNextNostrPublicKey && s.state?.ourCurrentNostrKey)
    )

    if (sendableSessions.length === 0) {
      return new Promise<unknown[]>((resolve) => {
        if (!this.messageQueue.has(recipientIdentityKey)) {
          this.messageQueue.set(recipientIdentityKey, [])
        }
        this.messageQueue.get(recipientIdentityKey)!.push({event, resolve})
        this.listenToUser(recipientIdentityKey)
      })
    }

    for (const session of sendableSessions) {
      const {event: encryptedEvent} = session.sendEvent(event)
      results.push(encryptedEvent)
      publishPromises.push(
        this.nostrPublish(encryptedEvent)
          .then(() => {
            this.saveSession(recipientIdentityKey, session.name || "unknown", session)
          })
          .catch(() => {})
      )
    }

    const ourPublicKey = getPublicKey(this.ourIdentityKey)
    const ownUserRecord = this.userRecords.get(ourPublicKey)
    if (ownUserRecord) {
      // Inline getActiveSessions logic for own devices
      const ownActiveSessions: Session[] = []
      if (!ownUserRecord.isStale) {
        for (const device of ownUserRecord.devices.values()) {
          if (!device.isStale && device.activeSession) {
            ownActiveSessions.push(device.activeSession)
          }
        }
      }
      const ownSendableSessions = ownActiveSessions.filter(
        (s) => !!(s.state?.theirNextNostrPublicKey && s.state?.ourCurrentNostrKey)
      )
      for (const session of ownSendableSessions) {
        const {event: encryptedEvent} = session.sendEvent(event)
        results.push(encryptedEvent)
        publishPromises.push(
          this.nostrPublish(encryptedEvent)
            .then(() => {
              this.saveSession(ourPublicKey, session.name || "unknown", session)
            })
            .catch(() => {})
        )
      }
    }

    if (publishPromises.length > 0) {
      await Promise.all(publishPromises)
    }

    return results
  }

  private setupUserInviteSubscription(userPubkey: string) {
    // Don't subscribe multiple times to the same user
    const inviteSubscriptionId = `invite:${userPubkey}`
    if (this.subscriptionManager.unsubscribe(inviteSubscriptionId)) {
      // Already had subscription, cleaned it up, will create new one below
    }

    const unsubscribe = Invite.fromUser(
      userPubkey,
      this.nostrSubscribe,
      async (_invite) => {
        try {
          const deviceId =
            _invite instanceof Invite && _invite.deviceId ? _invite.deviceId : "unknown"

          const userRecord = this.userRecords.get(userPubkey)
          if (userRecord && !userRecord.isStale) {
            // Inline getActiveSessions logic to check for existing session
            let hasExistingSession = false
            for (const device of userRecord.devices.values()) {
              if (
                !device.isStale &&
                device.activeSession &&
                device.activeSession.name === deviceId
              ) {
                hasExistingSession = true
                break
              }
            }
            if (hasExistingSession) {
              return
            }
          }

          console.log(
            `${getPublicKey(this.ourIdentityKey)} accepting invite from ${userPubkey}...`
          )
          const {session, event} = await _invite.accept(
            this.nostrSubscribe,
            getPublicKey(this.ourIdentityKey),
            this.ourIdentityKey
          )
          this.nostrPublish(event)?.catch((err) =>
            console.error("Failed to publish acceptance:", err)
          )

          // Store the new session
          let currentUserRecord = this.userRecords.get(userPubkey)
          if (!currentUserRecord) {
            currentUserRecord = {
              userId: userPubkey,
              devices: new Map(),
              isStale: false,
              createdAt: Date.now(),
              lastActivity: Date.now(),
            }
            this.userRecords.set(userPubkey, currentUserRecord)
          }

          // Ensure session name matches deviceId
          session.name = deviceId

          // Inline upsertSession logic
          const device = currentUserRecord.devices.get(deviceId)
          const updatedInactive = device?.activeSession
            ? [device.activeSession, ...(device.inactiveSessions || [])]
            : device?.inactiveSessions || []

          const updatedDevice: DeviceRecord = {
            deviceId: deviceId,
            userId: userPubkey,
            publicKey: session.state?.theirNextNostrPublicKey || "",
            activeSession: session,
            inactiveSessions: updatedInactive,
            isStale: false,
            createdAt: device?.createdAt || Date.now(),
            lastActivity: Date.now(),
          }

          const updatedDevices = new Map(currentUserRecord.devices)
          updatedDevices.set(deviceId, updatedDevice)

          this.userRecords.set(userPubkey, {
            ...currentUserRecord,
            devices: updatedDevices,
            lastActivity: Date.now(),
          })

          this.saveSession(userPubkey, deviceId, session)

          // Set up session subscription
          const sessionSubscriptionId = `session:${userPubkey}:${deviceId}`
          this.subscriptionManager.unsubscribeByDevice(userPubkey, deviceId)

          const sessionUnsubscribe = session.onEvent((_event: Rumor) => {
            // Process message immediately, but schedule saving for later
            // This avoids circular dependency with the operation queue
            Promise.resolve().then(async () => {
              try {
                await this._processReceivedMessage(session, _event, userPubkey, deviceId)
              } catch (error) {
                console.error("Error processing received message:", error)
              }
            })
          })

          this.subscriptionManager.subscribe(
            sessionSubscriptionId,
            sessionUnsubscribe,
            "session",
            {userId: userPubkey, deviceId: deviceId}
          )

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
            }, 1000)
          }

          return event
        } catch (err) {
          console.error(
            `${getPublicKey(this.ourIdentityKey)} failed to accept invite from ${userPubkey}:`,
            err
          )
        }
      }
    )

    this.subscriptionManager.subscribe(inviteSubscriptionId, unsubscribe, "invite", {
      userId: userPubkey,
    })
  }

  listenToUser(userPubkey: string) {
    this.setupUserInviteSubscription(userPubkey)
  }

  private internalSubscriptions: Set<OnEventCallback> = new Set()

  onEvent(callback: OnEventCallback) {
    this.internalSubscriptions.add(callback)

    return () => {
      this.internalSubscriptions.delete(callback)
    }
  }

  close() {
    this.subscriptionManager.close()

    // Close all sessions
    for (const userRecord of this.userRecords.values()) {
      for (const device of userRecord.devices.values()) {
        device.activeSession?.close()
        device.inactiveSessions.forEach((session) => session.close())
      }
    }
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
    let userRecord = this.userRecords.get(ourPublicKey)
    if (!userRecord) {
      userRecord = {
        userId: ourPublicKey,
        devices: new Map(),
        isStale: false,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      }
      this.userRecords.set(ourPublicKey, userRecord)
    }

    const deviceId = session.name || "unknown"

    // Ensure session name matches deviceId
    session.name = deviceId

    // Inline upsertSession logic
    const device = userRecord.devices.get(deviceId)
    const updatedInactive = device?.activeSession
      ? [device.activeSession, ...(device.inactiveSessions || [])]
      : device?.inactiveSessions || []

    const updatedDevice: DeviceRecord = {
      deviceId: deviceId,
      userId: ourPublicKey,
      publicKey: session.state?.theirNextNostrPublicKey || "",
      activeSession: session,
      inactiveSessions: updatedInactive,
      isStale: false,
      createdAt: device?.createdAt || Date.now(),
      lastActivity: Date.now(),
    }

    const updatedDevices = new Map(userRecord.devices)
    updatedDevices.set(deviceId, updatedDevice)

    this.userRecords.set(ourPublicKey, {
      ...userRecord,
      devices: updatedDevices,
      lastActivity: Date.now(),
    })

    await this.saveSession(ourPublicKey, deviceId, session)

    // Set up session subscription
    const sessionSubscriptionId = `session:${ourPublicKey}:${deviceId}`
    this.subscriptionManager.unsubscribeByDevice(ourPublicKey, deviceId)

    const sessionUnsubscribe = session.onEvent((_event: Rumor) => {
      Promise.resolve().then(async () => {
        try {
          await this._processReceivedMessage(session, _event, ourPublicKey, deviceId)
        } catch (error) {
          console.error("Error processing received message:", error)
        }
      })
    })

    this.subscriptionManager.subscribe(
      sessionSubscriptionId,
      sessionUnsubscribe,
      "session",
      {userId: ourPublicKey, deviceId: deviceId}
    )
    this.nostrPublish(event)?.catch(() => {})
  }

  // Public methods for querying sessions - needed by other parts of the codebase
  getActiveSessions(userId: string): Session[] {
    const userRecord = this.userRecords.get(userId)
    if (!userRecord || userRecord.isStale) return []
    
    const sessions: Session[] = []
    for (const device of userRecord.devices.values()) {
      if (!device.isStale && device.activeSession) {
        sessions.push(device.activeSession)
      }
    }
    return sessions
  }
  
  getSendableSessions(userId: string): Session[] {
    return this.getActiveSessions(userId).filter(
      session => !!(session.state?.theirNextNostrPublicKey && session.state?.ourCurrentNostrKey)
    )
  }
  
  getAllUsersWithActiveSessions(): string[] {
    const userIds: string[] = []
    for (const [userId, userRecord] of this.userRecords.entries()) {
      if (!userRecord.isStale && this.getActiveSessions(userId).length > 0) {
        userIds.push(userId)
      }
    }
    return userIds
  }

  debugInfo(): string {
    const userCount = this.userRecords.size
    let deviceCount = 0
    let activeSessionCount = 0

    for (const userRecord of this.userRecords.values()) {
      deviceCount += userRecord.devices.size
      for (const device of userRecord.devices.values()) {
        if (device.activeSession && !device.isStale) {
          activeSessionCount++
        }
      }
    }

    return `SessionManager: ${userCount} users, ${deviceCount} devices, ${activeSessionCount} active sessions. ${this.subscriptionManager.debugInfo()}`
  }
}
