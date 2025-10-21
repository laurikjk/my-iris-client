import {
  DecryptFunction,
  NostrSubscribe,
  NostrPublish,
  Rumor,
  Unsubscribe,
  Invite,
  Session,
  serializeSessionState,
  deserializeSessionState,
} from "nostr-double-ratchet/src"
import {StorageAdapter, InMemoryStorageAdapter} from "./StorageAdapter"
import {KIND_CHAT_MESSAGE} from "../utils/constants"
import {getEventHash} from "nostr-tools"
export type OnEventCallback = (event: Rumor, from: string) => void

interface DeviceRecord {
  deviceId: string
  activeSession?: Session
  inactiveSessions: Session[]
}

interface UserRecord {
  publicKey: string
  devices: Map<string, DeviceRecord>
  foundInvites: Map<string, Invite>
}

type StoredSessionEntry = ReturnType<typeof serializeSessionState>

interface StoredDeviceRecord {
  deviceId: string
  activeSession: StoredSessionEntry | null
  inactiveSessions: StoredSessionEntry[]
}

interface StoredUserRecord {
  publicKey: string
  devices: StoredDeviceRecord[]
}

export default class SessionManager {
  // Versioning
  private readonly storageVersion = "1"
  private readonly versionPrefix: string

  // Params
  private deviceId: string
  private storage: StorageAdapter
  private nostrSubscribe: NostrSubscribe
  private nostrPublish: NostrPublish
  private ourIdentityKey: Uint8Array | DecryptFunction
  private ourPublicKey: string

  // Data
  private userRecords: Map<string, UserRecord> = new Map()
  private messageHistory: Map<string, Rumor[]> = new Map()

  // Subscriptions
  private ourDeviceInviteSubscription: Unsubscribe | null = null
  private ourOtherDeviceInviteSubscription: Unsubscribe | null = null
  private inviteSubscriptions: Map<string, Unsubscribe> = new Map()
  private sessionSubscriptions: Map<string, Unsubscribe> = new Map()

  // Callbacks
  private internalSubscriptions: Set<OnEventCallback> = new Set()

  // Initialization flag
  private initialized: boolean = false

  constructor(
    ourPublicKey: string,
    ourIdentityKey: Uint8Array | DecryptFunction,
    deviceId: string,
    nostrSubscribe: NostrSubscribe,
    nostrPublish: NostrPublish,
    storage?: StorageAdapter
  ) {
    this.userRecords = new Map()
    this.nostrSubscribe = nostrSubscribe
    this.nostrPublish = nostrPublish
    this.ourPublicKey = ourPublicKey
    this.ourIdentityKey = ourIdentityKey
    this.deviceId = deviceId
    this.storage = storage || new InMemoryStorageAdapter()
    this.versionPrefix = `v${this.storageVersion}`
  }

  async init() {
    if (this.initialized) return
    this.initialized = true

    await this.runMigrations().catch((error) => {
      console.error("Failed to run migrations:", error)
    })

    await this.loadAllUserRecords().catch((error) => {
      console.error("Failed to load user records:", error)
    })

    const ourInviteFromStorage: Invite | null = await this.storage
      .get<string>(this.deviceInviteKey(this.deviceId))
      .then((data) => {
        if (!data) return null
        try {
          return Invite.deserialize(data)
        } catch {
          return null
        }
      })

    const invite =
      ourInviteFromStorage || Invite.createNew(this.ourPublicKey, this.deviceId)

    await this.storage.put(this.deviceInviteKey(this.deviceId), invite.serialize())

    this.ourDeviceInviteSubscription = invite.listen(
      this.ourIdentityKey,
      this.nostrSubscribe,
      async (session, inviteePubkey, deviceId) => {
        if (!deviceId || deviceId === this.deviceId) return
        const nostrEventId = session.name
        const acceptanceKey = this.inviteAcceptKey(nostrEventId, inviteePubkey, deviceId)
        const nostrEventIdInStorage = await this.storage.get<string>(acceptanceKey)

        if (nostrEventIdInStorage) {
          return
        }

        await this.storage.put(acceptanceKey, "1")

        this.attachSessionSubscription(inviteePubkey, deviceId, session)
      }
    )

    const inviteNostrEvent = invite.getEvent()
    this.nostrPublish(inviteNostrEvent).catch((error) => {
      console.error("Failed to publish our device invite:", error)
    })
  }

  // -------------------
  // Idempotency helpers
  // -------------------
  private getOrCreateUserRecord(userPubkey: string): UserRecord {
    let rec = this.userRecords.get(userPubkey)
    if (!rec) {
      rec = {publicKey: userPubkey, devices: new Map(), foundInvites: new Map()}
      this.userRecords.set(userPubkey, rec)
    }
    return rec
  }

  private getOrCreateDeviceRecord(userPubkey: string, deviceId: string): DeviceRecord {
    const ur = this.getOrCreateUserRecord(userPubkey)
    let dr = ur.devices.get(deviceId)
    if (!dr) {
      dr = {deviceId, inactiveSessions: []}
      ur.devices.set(deviceId, dr)
    }
    return dr
  }

  private sessionKey(userPubkey: string, deviceId: string, sessionName: string) {
    return `${this.sessionKeyPrefix(userPubkey)}${deviceId}/${sessionName}`
  }
  private inviteKey(userPubkey: string) {
    return this.userInviteKey(userPubkey)
  }
  private inviteAcceptKey(nostrEventId: string, userPubkey: string, deviceId: string) {
    return `${this.inviteAcceptKeyPrefix(userPubkey)}${deviceId}/${nostrEventId}`
  }

  private deviceInviteKey(deviceId: string) {
    return `${this.versionPrefix}/device-invite/${deviceId}`
  }

  private userInviteKey(userPubkey: string) {
    return `${this.versionPrefix}/invite/${userPubkey}`
  }

  private inviteAcceptKeyPrefix(userPublicKey: string) {
    return `${this.versionPrefix}/invite-accept/${userPublicKey}/`
  }

  private sessionKeyPrefix(userPublicKey: string) {
    return `${this.versionPrefix}/session/${userPublicKey}/`
  }

  private userRecordKey(publicKey: string) {
    return `${this.userRecordKeyPrefix()}${publicKey}`
  }

  private userRecordKeyPrefix() {
    return `${this.versionPrefix}/user/`
  }
  private versionKey() {
    return `storage-version`
  }

  private attachSessionSubscription(
    userPubkey: string,
    deviceId: string,
    session: Session
  ): void {
    const key = this.sessionKey(userPubkey, deviceId, session.name)
    if (this.sessionSubscriptions.has(key)) return

    const dr = this.getOrCreateDeviceRecord(userPubkey, deviceId)
    if (dr.activeSession) {
      dr.inactiveSessions.push(dr.activeSession)
    }
    dr.activeSession = session

    if (dr.inactiveSessions.length > 10) {
      dr.inactiveSessions = dr.inactiveSessions.slice(-10)
    }

    const unsub = session.onEvent((event) => {
      for (const cb of this.internalSubscriptions) cb(event, userPubkey)
      this.storeUserRecord(userPubkey).catch(console.error)
    })
    this.storeUserRecord(userPubkey).catch(console.error)
    this.sessionSubscriptions.set(key, unsub)
  }

  private attachInviteSubscription(
    userPubkey: string,
    onInvite?: (invite: Invite) => void | Promise<void>
  ): void {
    const key = this.inviteKey(userPubkey)
    if (this.inviteSubscriptions.has(key)) return

    const unsubscribe = Invite.fromUser(
      userPubkey,
      this.nostrSubscribe,
      async (invite) => {
        if (!invite.deviceId) return

        const ur = this.getOrCreateUserRecord(userPubkey)
        if (!ur.foundInvites.has(invite.deviceId)) {
          ur.foundInvites.set(invite.deviceId, invite)
        }

        if (onInvite) await onInvite(invite)
      }
    )

    this.inviteSubscriptions.set(key, unsubscribe)
  }

  setupUser(userPubkey: string) {
    this.getOrCreateUserRecord(userPubkey)

    this.attachInviteSubscription(userPubkey, async (invite) => {
      const {deviceId} = invite

      if (!deviceId) return

      const currentActiveSession = this.getOrCreateDeviceRecord(
        userPubkey,
        deviceId
      ).activeSession

      if (currentActiveSession) {
        return
      }

      const {session, event} = await invite.accept(
        this.nostrSubscribe,
        this.ourPublicKey,
        this.ourIdentityKey,
        this.deviceId
      )
      await this.nostrPublish(event)
        .then(() => this.attachSessionSubscription(userPubkey, deviceId, session))
        .then(() => this.sendMessageHistory(userPubkey, deviceId))
        .catch(console.error)
    })
  }

  onEvent(callback: OnEventCallback) {
    this.internalSubscriptions.add(callback)

    return () => {
      this.internalSubscriptions.delete(callback)
    }
  }

  getDeviceId(): string {
    return this.deviceId
  }

  getUserRecords(): Map<string, UserRecord> {
    return this.userRecords
  }

  close() {
    for (const unsubscribe of this.inviteSubscriptions.values()) {
      unsubscribe()
    }

    for (const unsubscribe of this.sessionSubscriptions.values()) {
      unsubscribe()
    }

    this.ourDeviceInviteSubscription?.()
    this.ourOtherDeviceInviteSubscription?.()
  }

  async deleteUser(userPubkey: string): Promise<void> {
    await this.init()

    const userRecord = this.userRecords.get(userPubkey)

    if (userRecord) {
      for (const device of userRecord.devices.values()) {
        if (device.activeSession) {
          this.removeSessionSubscription(
            userPubkey,
            device.deviceId,
            device.activeSession.name
          )
        }

        for (const session of device.inactiveSessions) {
          this.removeSessionSubscription(userPubkey, device.deviceId, session.name)
        }
      }

      this.userRecords.delete(userPubkey)
    }

    const inviteKey = this.inviteKey(userPubkey)
    const inviteUnsub = this.inviteSubscriptions.get(inviteKey)
    if (inviteUnsub) {
      inviteUnsub()
      this.inviteSubscriptions.delete(inviteKey)
    }

    this.messageHistory.delete(userPubkey)

    await Promise.allSettled([
      this.storage.del(this.inviteKey(userPubkey)),
      this.deleteUserSessionsFromStorage(userPubkey),
      this.storage.del(this.userRecordKey(userPubkey)),
    ])
  }

  private removeSessionSubscription(
    userPubkey: string,
    deviceId: string,
    sessionName: string
  ) {
    const key = this.sessionKey(userPubkey, deviceId, sessionName)
    const unsubscribe = this.sessionSubscriptions.get(key)
    if (unsubscribe) {
      unsubscribe()
      this.sessionSubscriptions.delete(key)
    }
  }

  private async deleteUserSessionsFromStorage(userPubkey: string): Promise<void> {
    const prefix = this.sessionKeyPrefix(userPubkey)
    const keys = await this.storage.list(prefix)
    await Promise.all(keys.map((key) => this.storage.del(key)))
  }

  private async sendMessageHistory(
    recipientPublicKey: string,
    deviceId: string
  ): Promise<void> {
    const history = this.messageHistory.get(recipientPublicKey) || []
    const userRecord = this.userRecords.get(recipientPublicKey)
    if (!userRecord) {
      return
    }
    const device = userRecord.devices.get(deviceId)
    if (!device) {
      return
    }
    for (const event of history) {
      const {activeSession} = device
      if (!activeSession) {
        return
      }
      const {event: verifiedEvent} = activeSession.sendEvent(event)
      await this.nostrPublish(verifiedEvent)
      await this.storeUserRecord(recipientPublicKey)
    }
  }

  async sendEvent(
    recipientIdentityKey: string,
    event: Partial<Rumor>
  ): Promise<Rumor | undefined> {
    await this.init()

    const userRecord = this.getOrCreateUserRecord(recipientIdentityKey)
    const ourUserRecord = this.getOrCreateUserRecord(this.ourPublicKey)

    this.setupUser(recipientIdentityKey)
    this.setupUser(this.ourPublicKey)

    const devices = [
      ...Array.from(userRecord.devices.values()),
      ...Array.from(ourUserRecord.devices.values()),
    ]

    // Send to all devices in background
    Promise.allSettled(
      devices.map(async (device) => {
        const {activeSession} = device
        if (!activeSession) return
        const {event: verifiedEvent} = activeSession.sendEvent(event)
        await this.nostrPublish(verifiedEvent).catch(console.error)
      })
    )
      .then(() => this.storeUserRecord(recipientIdentityKey))
      .catch(console.error)

    // Return the event with computed ID (same as library would compute)
    return event as Rumor
  }

  async sendMessage(
    recipientPublicKey: string,
    content: string,
    options: {kind?: number; tags?: string[][]} = {}
  ): Promise<Rumor> {
    const {kind = KIND_CHAT_MESSAGE, tags = []} = options

    // Build message exactly as library does (Session.ts sendEvent)
    const now = Date.now()
    const builtTags = this.buildMessageTags(recipientPublicKey, tags)

    const rumor: Rumor = {
      content,
      kind,
      created_at: Math.floor(now / 1000),
      tags: builtTags,
      pubkey: this.ourPublicKey,
      id: "", // Will compute next
    }

    if (!rumor.tags.some(([k]) => k === "ms")) {
      rumor.tags.push(["ms", String(now)])
    }

    rumor.id = getEventHash(rumor)

    this.messageHistory.set(recipientPublicKey, [
      ...(this.messageHistory.get(recipientPublicKey) || []),
      rumor,
    ])

    this.sendEvent(recipientPublicKey, rumor).catch(console.error)

    return rumor
  }

  private buildMessageTags(
    recipientPublicKey: string,
    extraTags: string[][]
  ): string[][] {
    const hasRecipientPTag = extraTags.some(
      (tag) => tag[0] === "p" && tag[1] === recipientPublicKey
    )
    const tags = hasRecipientPTag
      ? [...extraTags]
      : [["p", recipientPublicKey], ...extraTags]
    return tags
  }

  private storeUserRecord(publicKey: string) {
    const data: StoredUserRecord = {
      publicKey: publicKey,
      devices: Array.from(this.userRecords.get(publicKey)?.devices.entries() || []).map(
        ([, device]) => ({
          deviceId: device.deviceId,
          activeSession: device.activeSession
            ? serializeSessionState(device.activeSession.state)
            : null,
          inactiveSessions: device.inactiveSessions.map((session) =>
            serializeSessionState(session.state)
          ),
        })
      ),
    }
    return this.storage.put(this.userRecordKey(publicKey), data)
  }

  private loadUserRecord(publicKey: string) {
    return this.storage
      .get<StoredUserRecord>(this.userRecordKey(publicKey))
      .then((data) => {
        if (!data) return

        const devices = new Map<string, DeviceRecord>()

        for (const deviceData of data.devices) {
          const {
            deviceId,
            activeSession: serializedActive,
            inactiveSessions: serializedInactive,
          } = deviceData

          try {
            const activeSession = serializedActive
              ? new Session(
                  this.nostrSubscribe,
                  deserializeSessionState(serializedActive)
                )
              : undefined

            const inactiveSessions = serializedInactive.map(
              (entry) => new Session(this.nostrSubscribe, deserializeSessionState(entry))
            )

            devices.set(deviceId, {
              deviceId,
              activeSession,
              inactiveSessions,
            })
          } catch (e) {
            console.error(
              `Failed to deserialize session for user ${publicKey}, device ${deviceId}:`,
              e
            )
          }
        }

        for (const device of devices.values()) {
          const {deviceId, activeSession, inactiveSessions} = device
          if (!deviceId) continue

          if (activeSession) {
            const sessionSubscriptionId = this.sessionKey(
              publicKey,
              deviceId,
              activeSession.name
            )
            if (!this.sessionSubscriptions.has(sessionSubscriptionId)) {
              const unsubscribe = activeSession.onEvent((event) => {
                for (const callback of this.internalSubscriptions) {
                  callback(event, publicKey)
                }
                this.storeUserRecord(publicKey).catch(console.error)
              })
              this.sessionSubscriptions.set(sessionSubscriptionId, unsubscribe)
            }
          }

          for (const session of inactiveSessions) {
            const sessionSubscriptionId = this.sessionKey(
              publicKey,
              deviceId,
              session.name
            )
            if (this.sessionSubscriptions.has(sessionSubscriptionId)) {
              continue
            }
            const unsubscribe = session.onEvent((event) => {
              for (const callback of this.internalSubscriptions) {
                callback(event, publicKey)
              }
              this.storeUserRecord(publicKey).catch(console.error)
            })
            this.sessionSubscriptions.set(sessionSubscriptionId, unsubscribe)
          }
        }

        this.userRecords.set(publicKey, {
          publicKey: data.publicKey,
          devices,
          foundInvites: new Map(),
        })
      })
      .catch((error) => {
        console.error(`Failed to load user record for ${publicKey}:`, error)
      })
  }
  private loadAllUserRecords() {
    const prefix = this.userRecordKeyPrefix()
    return this.storage.list(prefix).then((keys) => {
      return Promise.all(
        keys.map((key) => {
          const publicKey = key.slice(prefix.length)
          return this.loadUserRecord(publicKey)
        })
      )
    })
  }

  private async runMigrations() {
    // Run migrations sequentially
    let version = await this.storage.get<string>(this.versionKey())

    // First migration
    if (!version) {
      // Fetch all existing invites
      // Assume no version prefix
      // Deserialize and serialize to start using persistent createdAt
      // Re-save invites with proper keys
      const oldInvitePrefix = "invite/"
      const inviteKeys = await this.storage.list(oldInvitePrefix)
      await Promise.all(
        inviteKeys.map(async (key) => {
          try {
            const publicKey = key.slice(oldInvitePrefix.length)
            const inviteData = await this.storage.get<string>(key)
            if (inviteData) {
              const newKey = this.userInviteKey(publicKey)
              const invite = Invite.deserialize(inviteData)
              const serializedInvite = invite.serialize()
              await this.storage.put(newKey, serializedInvite)
              await this.storage.del(key)
            }
          } catch (e) {}
        })
      )

      // Fetch all existing user records
      // Assume no version prefix
      // Remove all old sessions as these may have key issues
      // Re-save user records without sessions with proper keys
      const oldUserRecordPrefix = "user/"
      const sessionKeys = await this.storage.list(oldUserRecordPrefix)
      await Promise.all(
        sessionKeys.map(async (key) => {
          try {
            const publicKey = key.slice(oldUserRecordPrefix.length)
            const userRecordData = await this.storage.get<StoredUserRecord>(key)
            if (userRecordData) {
              const newKey = this.userRecordKey(publicKey)
              const newUserRecordData: StoredUserRecord = {
                publicKey: userRecordData.publicKey,
                devices: userRecordData.devices.map((device) => ({
                  deviceId: device.deviceId,
                  activeSession: null,
                  inactiveSessions: [],
                })),
              }
              await this.storage.put(newKey, newUserRecordData)
              await this.storage.del(key)
            }
          } catch (e) {}
        })
      )

      // Set version to 1 so next migration can run
      version = "1"
      await this.storage.put(this.versionKey(), version)

      return
    }

    // Future migrations
    if (version === "1") {
      return
    }
  }
}
