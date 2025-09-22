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

  // Subscriptions
  private ourDeviceInviteSubscription: Unsubscribe | null = null
  private ourOtherDeviceInviteSubscription: Unsubscribe | null = null
  private inviteSubscriptions: Map<string, Unsubscribe> = new Map()
  private sessionSubscriptions: Map<string, Unsubscribe> = new Map()

  // Callbacks
  private internalSubscriptions: Set<OnEventCallback> = new Set()

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
    const ourPublicKey = getPublicKey(this.ourIdentityKey)

    await this.loadAllUserRecords()

    if (!this.userRecords.has(ourPublicKey)) {
      this.userRecords.set(getPublicKey(this.ourIdentityKey), {
        publicKey: getPublicKey(this.ourIdentityKey),
        devices: new Map(),
        foundInvites: new Map(),
      })
    }

    console.warn("Loaded user records", this.userRecords.keys())

    return this.storage
      .get<string>(`invite/${this.deviceId}`)
      .then((data) => {
        if (!data) return null
        const invite = Invite.deserialize(data)
        if (invite) {
          return invite
        }
      })
      .catch(() => null)
      .then(async (invite) => {
        if (invite) return invite
        const newInvite = Invite.createNew(ourPublicKey, this.deviceId)
        await this.storage.put(`invite/${this.deviceId}`, newInvite.serialize())
        const event = newInvite.getEvent()
        await this.nostrPublish(event).catch((e) => {
          console.error("Failed to publish our own invite for", this.deviceId, e)
        })
        console.warn(
          "Created new invite for our device",
          this.deviceId,
          newInvite,
          ourPublicKey
        )
        return newInvite
      })
      .then((invite) => {
        this.ourDeviceInviteSubscription = invite.listen(
          this.ourIdentityKey,
          this.nostrSubscribe,
          async (session, inviteePubkey, deviceId) => {
            console.warn("GOT ACCEPTANCE FROM", deviceId)

            // important: check if this is an old acceptance

            if (this.userRecords.get(inviteePubkey)?.devices.has(deviceId)) {
              console.warn("Already have session for", deviceId)
              return
            }
            const deviceRecord: DeviceRecord = {
              deviceId: deviceId,
              activeSession: session,
              inactiveSessions: [],
            }
            if (!this.userRecords.has(inviteePubkey)) {
              this.userRecords.set(inviteePubkey, {
                publicKey: inviteePubkey,
                devices: new Map([[deviceId, deviceRecord]]),
                foundInvites: new Map(),
              })
            } else {
              this.userRecords.get(inviteePubkey)?.devices.set(deviceId, deviceRecord)
            }
            const sessionSubscriptionId = `session/${inviteePubkey}/${deviceId}`
            if (this.sessionSubscriptions.has(sessionSubscriptionId)) {
              return
            }
            const unsubscribe = session.onEvent((event) => {
              for (const callback of this.internalSubscriptions) {
                callback(event, inviteePubkey)
              }
            })
            this.sessionSubscriptions.set(sessionSubscriptionId, unsubscribe)
          }
        )

        // 3. Subscribe to our own invites from other devices
        this.ourOtherDeviceInviteSubscription = Invite.fromUser(
          ourPublicKey,
          this.nostrSubscribe,
          async (invite) => {
            if (!invite.deviceId) return
            if (this.userRecords.get(ourPublicKey)?.foundInvites.has(invite.deviceId))
              return

            this.userRecords.get(ourPublicKey)?.foundInvites.set(invite.deviceId, invite)
          }
        )
      })
  }

  setupUser(userPubkey: string) {
    if (this.userRecords.has(userPubkey)) {
      return
    }

    this.userRecords.set(userPubkey, {
      publicKey: userPubkey,
      devices: new Map(),
      foundInvites: new Map(),
    })

    const inviteSubscriptionId = `invite/${userPubkey}`
    const unsubscribe = Invite.fromUser(
      userPubkey,
      this.nostrSubscribe,
      async (invite) => {
        console.warn("FOUND INVITE", userPubkey, invite.deviceId)
        if (!invite.deviceId) return
        console.warn("Storing invite", invite.deviceId)
        if (!this.userRecords.get(userPubkey)?.foundInvites.has(invite.deviceId)) {
          this.userRecords.get(userPubkey)?.foundInvites.set(invite.deviceId, invite)
        }
      }
    )
    this.inviteSubscriptions.set(inviteSubscriptionId, unsubscribe)
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

  private acceptInvitesFromUser(userPubkey: string): Promise<void[]> {
    const invites = this.userRecords.get(userPubkey)?.foundInvites.values()
    if (!invites) return Promise.resolve([])

    return Promise.all(
      invites.map((invite) => {
        const {deviceId} = invite
        if (!deviceId) return Promise.resolve()
        if (this.userRecords.get(userPubkey)?.devices.has(deviceId)) {
          return Promise.resolve()
        }

        return invite
          .accept(
            this.nostrSubscribe,
            getPublicKey(this.ourIdentityKey),
            this.ourIdentityKey,
            this.deviceId
          )
          .then(async ({session, event}) => {
            await this.nostrPublish(event)
            this.userRecords.get(userPubkey)?.devices.set(deviceId, {
              deviceId: deviceId,
              activeSession: session,
              inactiveSessions: [],
            })
            const sessionSubscriptionId = `session/${userPubkey}/${deviceId}`
            if (this.sessionSubscriptions.has(sessionSubscriptionId)) {
              return
            }
            const unsubscribe = session.onEvent((event) => {
              for (const callback of this.internalSubscriptions) {
                callback(event, userPubkey)
              }
            })
            this.sessionSubscriptions.set(sessionSubscriptionId, unsubscribe)
            this.userRecords.get(userPubkey)?.foundInvites.delete(deviceId)
          })
      })
    )
  }

  async sendEvent(recipientIdentityKey: string, event: Partial<Rumor>): Promise<void[]> {
    const userRecord = this.userRecords.get(recipientIdentityKey)
    const ourUserRecord = this.userRecords.get(getPublicKey(this.ourIdentityKey))
    if (!userRecord) {
      console.warn("No user record for", recipientIdentityKey)
      return Promise.resolve([])
    }

    await this.acceptInvitesFromUser(recipientIdentityKey)
    await this.acceptInvitesFromUser(getPublicKey(this.ourIdentityKey))

    const devices = [
      ...Array.from(userRecord.devices.values()),
      ...Array.from(ourUserRecord?.devices.values() || []),
    ]

    console.warn(
      "Sending event to devices",
      devices.map((d) => d.deviceId)
    )

    return Promise.all(
      devices.map(async (device) => {
        const {activeSession} = device
        if (!activeSession) {
          console.warn("No active session for device", device.deviceId)
          return
        }
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
      tags: [],
      content,
    }

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
    console.warn(
      "Storing user record with these keys in state",
      this.deviceId,
      data.devices.map((d) => d.activeSession && JSON.parse(d.activeSession))
    )
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
      console.warn(
        "Loaded user record with these keys in state",
        Array.from(devices.values()).map(
          (d) =>
            d.activeSession && JSON.parse(serializeSessionState(d.activeSession.state))
        )
      )
      for (const device of devices.values()) {
        const {deviceId, activeSession} = device
        if (!activeSession || !deviceId) continue

        const sessionSubscriptionId = `session/${publicKey}/${deviceId}`
        if (this.sessionSubscriptions.has(sessionSubscriptionId)) {
          return
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
