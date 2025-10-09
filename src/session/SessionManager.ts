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

type SerializedSessionState = ReturnType<typeof serializeSessionState>

interface StoredDeviceRecord {
  deviceId: string
  activeSession: SerializedSessionState | null
  inactiveSessions: SerializedSessionState[]
}

interface StoredUserRecord {
  publicKey: string
  devices: StoredDeviceRecord[]
}

export default class SessionManager {
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
  }

  async init() {
    if (this.initialized) return
    this.initialized = true

    await this.loadAllUserRecords()

    return this.storage
      .get<string>(`invite/${this.deviceId}`)
      .then((data) => {
        if (!data) return null
        const invite = Invite.deserialize(data)
        return invite
      })
      .catch(() => null)
      .then(async (invite) => {
        if (invite) return invite
        const newInvite = Invite.createNew(this.ourPublicKey, this.deviceId)
        await this.storage.put(`invite/${this.deviceId}`, newInvite.serialize())
        const event = newInvite.getEvent()
        await this.nostrPublish(event).catch(console.error)
        return newInvite
      })
      .then((invite) => {
        // Listen to our invite
        this.ourDeviceInviteSubscription = invite.listen(
          this.ourIdentityKey,
          this.nostrSubscribe,
          (session, inviteePubkey, deviceId) => {
            if (!deviceId || deviceId === this.deviceId) return

            this.attachSessionSubscription(inviteePubkey, deviceId, session)
          }
        )
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
    return `session/${userPubkey}/${deviceId}/${sessionName}`
  }
  private inviteKey(userPubkey: string) {
    return `invite/${userPubkey}`
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
    })
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

      const currentInactiveSessions = this.getOrCreateDeviceRecord(
        userPubkey,
        deviceId
      ).inactiveSessions

      console.warn("Current sessions", currentActiveSession, currentInactiveSessions)

      const {session, event} = await invite.accept(
        this.nostrSubscribe,
        this.ourPublicKey,
        this.ourIdentityKey,
        this.deviceId
      )
      await this.nostrPublish(event).catch((e) => {
        console.error("Failed to publish acceptance to", deviceId, e)
      })
      this.attachSessionSubscription(userPubkey, deviceId, session)
      await this.sendMessageHistory(userPubkey, deviceId)
    })
  }

  onEvent(callback: OnEventCallback) {
    this.internalSubscriptions.add(callback)

    return () => {
      this.internalSubscriptions.delete(callback)
    }
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
      this.storage.del(`user/${userPubkey}`),
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
    const prefix = `session/${userPubkey}/`
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
      console.warn("No user record for", recipientPublicKey)
      return
    }
    const device = userRecord.devices.get(deviceId)
    if (!device) {
      console.warn("No device record for", deviceId)
      return
    }
    for (const event of history) {
      const {activeSession} = device
      if (!activeSession) {
        console.warn("No active session for device", device.deviceId)
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

    const sendingResults = await Promise.allSettled(
      devices.map(async (device) => {
        const {activeSession} = device
        if (!activeSession) return
        const {event: verifiedEvent, innerEvent} = activeSession.sendEvent(event)
        await this.nostrPublish(verifiedEvent)
        await this.storeUserRecord(recipientIdentityKey)
        return innerEvent
      })
    ).then((results) => {
      return results.find((res) => res !== undefined)
    })

    return sendingResults && sendingResults.status === "fulfilled"
      ? sendingResults.value
      : undefined
  }

  async sendMessage(
    recipientPublicKey: string,
    content: string,
    options: {kind?: number; tags?: string[][]} = {}
  ): Promise<Rumor> {
    const {kind = KIND_CHAT_MESSAGE, tags = []} = options

    const message: Rumor = {
      id: crypto.randomUUID(),
      pubkey: this.ourPublicKey,
      created_at: Math.floor(Date.now() / 1000),
      kind,
      tags: this.buildMessageTags(recipientPublicKey, tags),
      content,
    }

    this.messageHistory.set(recipientPublicKey, [
      ...(this.messageHistory.get(recipientPublicKey) || []),
      message,
    ])

    const sentEvent = await this.sendEvent(recipientPublicKey, message)

    if (!sentEvent) {
      // TODO: Library removes dashes from innerEvent IDs
      // Remove this workaround when sentEvent can be quaranteed
      // e.g. when at least one session exists
      const patchedId = message.id.replace("-", "")
      return {...message, id: patchedId}
    }

    return sentEvent
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
    const data = {
      publicKey: publicKey,
      devices: Array.from(this.userRecords.get(publicKey)?.devices.values() || []).map(
        (device) => ({
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
    return this.storage.put(`user/${publicKey}`, data)
  }

  private loadUserRecord(publicKey: string) {
    return this.storage.get<StoredUserRecord>(`user/${publicKey}`).then((data) => {
      if (!data) return
      const devices = new Map<string, DeviceRecord>()
      for (const deviceData of data.devices) {
        const {
          deviceId,
          activeSession: serializedActive,
          inactiveSessions: serializedInactive,
        } = deviceData
        const activeSession = serializedActive
          ? new Session(this.nostrSubscribe, deserializeSessionState(serializedActive))
          : undefined

        const inactiveSessions = serializedInactive.map(
          (state) => new Session(this.nostrSubscribe, deserializeSessionState(state))
        )
        devices.set(deviceId, {
          deviceId,
          activeSession,
          inactiveSessions,
        })
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
          if (this.sessionSubscriptions.has(sessionSubscriptionId)) {
            continue
          }
          const unsubscribe = activeSession.onEvent((event) => {
            for (const callback of this.internalSubscriptions) {
              callback(event, publicKey)
            }
          })
          if (unsubscribe)
            this.sessionSubscriptions.set(sessionSubscriptionId, unsubscribe)
        }
        for (const session of inactiveSessions) {
          const sessionSubscriptionId = this.sessionKey(publicKey, deviceId, session.name)
          if (this.sessionSubscriptions.has(sessionSubscriptionId)) {
            continue
          }
          const unsubscribe = session.onEvent((event) => {
            for (const callback of this.internalSubscriptions) {
              callback(event, publicKey)
            }
          })
          if (unsubscribe)
            this.sessionSubscriptions.set(sessionSubscriptionId, unsubscribe)
        }
      }
      this.userRecords.set(publicKey, {
        publicKey: data.publicKey,
        devices,
        foundInvites: new Map(),
      })
    })
  }
  private loadAllUserRecords() {
    return this.storage.list().then((keys) => {
      const userKeys = keys.filter((key) => key.startsWith("user/"))
      return Promise.all(
        userKeys.map((key) => {
          const publicKey = key.slice(5)
          return this.loadUserRecord(publicKey)
        })
      )
    })
  }
}
