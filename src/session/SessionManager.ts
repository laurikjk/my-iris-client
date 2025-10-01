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

export type OnEventCallback = (event: Rumor, from: string) => void

interface DeviceRecord {
  deviceId: string
  activeSession?: Session
  inactiveSessions: Session[]
  acceptedInviteKeys: Set<string>
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
            console.warn(
              "Received invite acceptance on our device",
              this.deviceId,
              "from",
              deviceId
            )
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
      dr = {deviceId, inactiveSessions: [], acceptedInviteKeys: new Set()}
      ur.devices.set(deviceId, dr)
    } else if (!dr.acceptedInviteKeys) {
      dr.acceptedInviteKeys = new Set()
    }
    return dr
  }

  private sessionKey(userPubkey: string, deviceId: string, sessionName: string) {
    return `session/${userPubkey}/${deviceId}/${sessionName}`
  }
  private inviteKey(userPubkey: string) {
    return `invite/${userPubkey}`
  }

  private setAsActiveSession(
    userPubkey: string,
    deviceId: string,
    session: Session
  ): void {
    const dr = this.getOrCreateDeviceRecord(userPubkey, deviceId)
    if (dr.activeSession === session) return

    dr.inactiveSessions = dr.inactiveSessions.filter((s) => s !== session)

    if (dr.activeSession) {
      dr.inactiveSessions.push(dr.activeSession)
    }
    dr.activeSession = session
    const seenNames = new Set<string>()
    dr.inactiveSessions = dr.inactiveSessions.filter((s) => {
      if (s === dr.activeSession) return false
      const name = s.name
      if (seenNames.has(name)) return false
      seenNames.add(name)
      return true
    })
    if (dr.inactiveSessions.length > 1) {
      dr.inactiveSessions = dr.inactiveSessions.slice(-1)
    }
    console.warn(
      "SessionManager:setAsActiveSession",
      JSON.stringify({
        deviceId,
        userPubkey,
        inactiveCount: dr.inactiveSessions.length,
        activeSessionName: session.name,
      })
    )
  }

  private attachSessionSubscription(
    userPubkey: string,
    deviceId: string,
    session: Session
  ): void {
    const key = this.sessionKey(userPubkey, deviceId, session.name)

    const dr = this.getOrCreateDeviceRecord(userPubkey, deviceId)
    console.warn(
      "SessionManager:attachSessionSubscription",
      JSON.stringify({
        scopeDevice: this.deviceId,
        userPubkey,
        deviceId,
        sessionName: session.name,
        inactiveCountBefore: dr.inactiveSessions.length + (dr.activeSession ? 1 : 0),
      })
    )
    this.setAsActiveSession(userPubkey, deviceId, session)

    const unsub = session.onEvent((event) => {
      for (const cb of this.internalSubscriptions) cb(event, userPubkey)
      this.setAsActiveSession(userPubkey, deviceId, session)
      this.storeUserRecord(userPubkey).catch((error) => {
        console.error("Failed to store user record after event", error)
      })
      this.storeUserRecord(getPublicKey(this.ourIdentityKey)).catch((error) => {
        console.error("Failed to store self record after event", error)
      })
    })
    this.sessionSubscriptions.set(key, unsub)
  }

  private attachInviteSubscription(
    userPubkey: string,
    onInvite?: (invite: Invite) => void | Promise<void>
  ): void {
    const key = this.inviteKey(userPubkey)
    if (this.inviteSubscriptions.has(key)) return

    console.warn(
      "SessionManager:attachInviteSubscription",
      JSON.stringify({scopeDevice: this.deviceId, userPubkey})
    )

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
    console.warn(
      "SessionManager:setupUser",
      JSON.stringify({scopeDevice: this.deviceId, userPubkey})
    )

    this.attachInviteSubscription(userPubkey, async (invite) => {
      const {deviceId} = invite

      if (!deviceId) return
      const dr = this.getOrCreateDeviceRecord(userPubkey, deviceId)
      const inviteKey = invite.inviterEphemeralPublicKey
      if (inviteKey && dr.acceptedInviteKeys.has(inviteKey)) {
        console.warn(
          "SessionManager:invite.skip",
          JSON.stringify({scopeDevice: this.deviceId, userPubkey, deviceId, inviteKey})
        )
        return
      }
      if (dr.activeSession) {
        console.warn("Already have active session with", deviceId, "on user", userPubkey)
        return
      }

      const {session, event} = await invite.accept(
        this.nostrSubscribe,
        getPublicKey(this.ourIdentityKey),
        this.ourIdentityKey,
        this.deviceId
      )
      console.warn(
        "SessionManager:invite.accept",
        JSON.stringify({
          scopeDevice: this.deviceId,
          userPubkey,
          deviceId,
          sessionName: session.name,
        })
      )
      if (inviteKey) {
        dr.acceptedInviteKeys.add(inviteKey)
      }
      await this.nostrPublish(event).catch((e) => {
        console.error("Failed to publish acceptance to", deviceId, e)
      })
      this.attachSessionSubscription(userPubkey, deviceId, session)
      await this.sendMessageHistory(userPubkey, deviceId)
      await this.storeUserRecord(userPubkey)
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

  async sendMessageHistory(recipientPublicKey: string, deviceId: string): Promise<void> {
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

    const tasks: Array<Promise<void>> = []

    for (const [pubkey, record] of [
      [recipientIdentityKey, userRecord] as const,
      [getPublicKey(this.ourIdentityKey), ourUserRecord] as const,
    ]) {
      for (const device of record.devices.values()) {
        tasks.push(this.sendEventToDevice(pubkey, device, event))
      }
    }

    const results = await Promise.allSettled(tasks)

    await this.storeUserRecord(recipientIdentityKey)
    await this.storeUserRecord(getPublicKey(this.ourIdentityKey))

    for (const result of results) {
      if (result.status === "rejected") {
        console.warn("sendEvent failed", result.reason)
      }
    }
    return results
  }

  private async sendEventToDevice(
    userPubkey: string,
    device: DeviceRecord,
    event: Partial<Rumor>
  ): Promise<void> {
    if (
      userPubkey === getPublicKey(this.ourIdentityKey) &&
      device.deviceId === this.deviceId
    ) {
      return
    }
    let session = device.activeSession
    if (!session) {
      console.warn("No active session for device", device.deviceId)
      return
    }

    if (!session.state.ourCurrentNostrKey) {
      const promotable = device.inactiveSessions.find(
        (candidate) => !!candidate.state.ourCurrentNostrKey
      )
      if (promotable) {
        this.setAsActiveSession(userPubkey, device.deviceId, promotable)
        session = promotable
      }
    }

    if (!session.state.ourCurrentNostrKey) {
      console.warn(
        "Skipping send for session without ourCurrentNostrKey",
        JSON.stringify({deviceId: device.deviceId, session: session.name})
      )
      return
    }

    const {event: verifiedEvent} = session.sendEvent(event)
    await this.nostrPublish(verifiedEvent)
    await this.storeUserRecord(userPubkey)
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

    // TODO: switch from this to message records (check Sesame spec)
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
          acceptedInviteKeys: Array.from(device.acceptedInviteKeys.values()),
        })
      ),
    }
    return this.storage.put(`user/${publicKey}`, data)
  }

  private loadUserRecord(publicKey: string) {
    return this.storage.get<any>(`user/${publicKey}`).then((data) => {
      console.warn("Loading user record for", publicKey, data)
      if (!data) return
      console.warn("Starting to deserialize user record for", publicKey)

      const userRecord = this.getOrCreateUserRecord(publicKey)
      userRecord.devices.clear()

      for (const deviceData of data.devices) {
        const deviceId = deviceData.deviceId
        if (!deviceId) continue

        const activeSession = deviceData.activeSession
          ? new Session(
              this.nostrSubscribe,
              deserializeSessionState(deviceData.activeSession)
            )
          : undefined
        console.warn("Deserialized active session for", deviceId, activeSession)

        const inactiveSessions = deviceData.inactiveSessions.map(
          (state: string) =>
            new Session(this.nostrSubscribe, deserializeSessionState(state))
        )
        console.warn("Deserialized inactive sessions for", deviceId, inactiveSessions)

        userRecord.devices.set(deviceId, {
          deviceId,
          activeSession,
          inactiveSessions,
          acceptedInviteKeys: new Set<string>(deviceData.acceptedInviteKeys || []),
        })

        if (activeSession) {
          this.attachRestoredSessionSubscription(publicKey, deviceId, activeSession, true)
        }

        for (const session of inactiveSessions) {
          this.attachRestoredSessionSubscription(publicKey, deviceId, session, false)
        }

        const deviceRecord = this.getOrCreateDeviceRecord(publicKey, deviceId)
        const activeCanSend = !!deviceRecord.activeSession?.state.ourCurrentNostrKey
        if (!activeCanSend) {
          const promotable = deviceRecord.inactiveSessions.find(
            (candidate) => !!candidate.state.ourCurrentNostrKey
          )
          if (promotable) {
            this.setAsActiveSession(publicKey, deviceId, promotable)
          }
        }
      }

      userRecord.foundInvites = new Map()

      console.warn("Loaded user record for", this.deviceId, userRecord.devices)
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
  getUserRecords() {
    return this.userRecords
  }
  getAllDeviceRecords() {
    return Array.from(this.userRecords.values()).flatMap((ur) =>
      Array.from(ur.devices.values())
    )
  }

  private attachRestoredSessionSubscription(
    userPubkey: string,
    deviceId: string,
    session: Session,
    makeActive: boolean
  ) {
    const key = this.sessionKey(userPubkey, deviceId, session.name)
    if (this.sessionSubscriptions.has(key)) return

    console.warn(
      "SessionManager:restoreSessionSubscription",
      JSON.stringify({
        scopeDevice: this.deviceId,
        userPubkey,
        deviceId,
        sessionName: session.name,
        makeActive,
      })
    )

    if (makeActive) {
      this.setAsActiveSession(userPubkey, deviceId, session)
    }

    const unsubscribe = session.onEvent((event) => {
      console.warn(
        "restored handler - Received event",
        JSON.stringify({deviceId, userPubkey, session: session.name})
      )
      for (const callback of this.internalSubscriptions) {
        callback(event, userPubkey)
      }
      this.setAsActiveSession(userPubkey, deviceId, session)
      this.storeUserRecord(userPubkey).catch((error) => {
        console.error("Failed to store user record after restored event", error)
      })
      this.storeUserRecord(getPublicKey(this.ourIdentityKey)).catch((error) => {
        console.error("Failed to store self record after restored event", error)
      })
    })

    this.sessionSubscriptions.set(key, unsubscribe)
  }
}
