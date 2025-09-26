import {
  NostrSubscribe,
  NostrPublish,
  Rumor,
  Unsubscribe,
  Invite,
  Session,
  serializeSessionState,
  deserializeSessionState,
} from "nostr-double-ratchet"
import {StorageAdapter, InMemoryStorageAdapter} from "./StorageAdapter"
import {getPublicKey} from "nostr-tools"
import {KIND_CHAT_MESSAGE} from "../utils/constants"

type AttachSessionResult =
  | {attached: true; used: "existing-session" | "new-session"}
  | {attached: false; reason: "already-subscribed"}

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

export default class SessionManager {
  // Params
  private deviceId: string
  private storage: StorageAdapter
  private nostrSubscribe: NostrSubscribe
  private nostrPublish: NostrPublish
  private ourIdentityKey: Uint8Array

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

  async init() {
    if (this.initialized) return
    this.initialized = true

    const ourPublicKey = getPublicKey(this.ourIdentityKey)

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
        const newInvite = Invite.createNew(ourPublicKey, this.deviceId)
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

  /** Idempotently get or create a UserRecord. Never overwrites existing maps. */
  private getOrCreateUserRecord(userPubkey: string): UserRecord {
    let rec = this.userRecords.get(userPubkey)
    if (!rec) {
      rec = {publicKey: userPubkey, devices: new Map(), foundInvites: new Map()}
      this.userRecords.set(userPubkey, rec)
    }
    return rec
  }

  /** Idempotently get or create a DeviceRecord under a user. Never overwrites existing fields. */
  private getOrCreateDeviceRecord(userPubkey: string, deviceId: string): DeviceRecord {
    const ur = this.getOrCreateUserRecord(userPubkey)
    let dr = ur.devices.get(deviceId)
    if (!dr) {
      dr = {deviceId, inactiveSessions: []}
      ur.devices.set(deviceId, dr)
    }
    return dr
  }

  private sessionKey(userPubkey: string, deviceId: string) {
    return `session/${userPubkey}/${deviceId}`
  }
  private inviteKey(userPubkey: string) {
    return `invite/${userPubkey}`
  }

  private attachSessionSubscription(
    userPubkey: string,
    deviceId: string,
    session: Session
  ): AttachSessionResult {
    const key = this.sessionKey(userPubkey, deviceId)
    // if (this.sessionSubscriptions.has(key)) {
    //   return {attached: false, reason: "already-subscribed"}
    // }

    const dr = this.getOrCreateDeviceRecord(userPubkey, deviceId)
    if (dr.activeSession) {
      dr.inactiveSessions.push(dr.activeSession)
    }
    dr.activeSession = session

    const unsub = session.onEvent((event) => {
      for (const cb of this.internalSubscriptions) cb(event, userPubkey)
    })
    this.sessionSubscriptions.set(key, unsub)

    return {
      attached: true,
      used: dr.activeSession === session ? "new-session" : "existing-session",
    }
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

      const {session, event} = await invite.accept(
        this.nostrSubscribe,
        getPublicKey(this.ourIdentityKey),
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
    console.warn("SessionManager: onEvent callback added")
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
  ): Promise<PromiseSettledResult<void>[]> {
    await this.init()
    const userRecord = this.getOrCreateUserRecord(recipientIdentityKey)
    const ourUserRecord = this.getOrCreateUserRecord(getPublicKey(this.ourIdentityKey))

    this.setupUser(recipientIdentityKey)
    this.setupUser(getPublicKey(this.ourIdentityKey))

    const devices = [
      ...Array.from(userRecord.devices.values()),
      ...Array.from(ourUserRecord.devices.values()),
    ]

    console.warn("my devices", ourUserRecord.devices)

    return Promise.allSettled(
      devices.map(async (device) => {
        const {activeSession} = device
        if (!activeSession) return
        const {event: verifiedEvent} = activeSession.sendEvent(event)
        await this.nostrPublish(verifiedEvent)
        await this.storeUserRecord(recipientIdentityKey)
      })
    )
  }

  async sendMessage(
    recipientPublicKey: string,
    content: string,
    kind: number = KIND_CHAT_MESSAGE
  ): Promise<Rumor> {
    const ourPubkey = getPublicKey(this.ourIdentityKey)

    const message: Partial<Rumor> = {
      id: crypto.randomUUID(),
      pubkey: ourPubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind,
      // TODO: spec says specify relay url too:https://github.com/nostr-protocol/nips/blob/master/17.md
      // Let's think about this when looking at invite revoking etc.
      tags: [["p", recipientPublicKey]],
      content,
    }

    this.messageHistory.set(recipientPublicKey, [
      ...(this.messageHistory.get(recipientPublicKey) || []),
      message as Rumor,
    ])
    await this.sendEvent(recipientPublicKey, message)

    // Return the complete message for chat history
    return message as Rumor
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
    return this.storage.get<any>(`user/${publicKey}`).then((data) => {
      if (!data) return
      const devices = new Map<string, DeviceRecord>()
      for (const deviceData of data.devices) {
        const deviceId = deviceData.deviceId
        const activeSession = deviceData.activeSession
          ? new Session(
              this.nostrSubscribe,
              deserializeSessionState(deviceData.activeSession)
            )
          : undefined
        const inactiveSessions = deviceData.inactiveSessions.map(
          (state: string) =>
            new Session(this.nostrSubscribe, deserializeSessionState(state))
        )
        devices.set(deviceId, {
          deviceId,
          activeSession,
          inactiveSessions,
        })
      }
      for (const device of devices.values()) {
        const {deviceId, activeSession} = device
        if (!activeSession || !deviceId) continue

        const sessionSubscriptionId = `session/${publicKey}/${deviceId}`
        if (this.sessionSubscriptions.has(sessionSubscriptionId)) {
          continue
        }
        const unsubscribe = activeSession.onEvent((event) => {
          for (const callback of this.internalSubscriptions) {
            callback(event, publicKey)
          }
        })
        if (unsubscribe) this.sessionSubscriptions.set(sessionSubscriptionId, unsubscribe)
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
