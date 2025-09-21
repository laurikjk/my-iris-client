import {
  NostrSubscribe,
  NostrPublish,
  Rumor,
  Unsubscribe,
  Invite,
  Session,
} from "nostr-double-ratchet"
import {StorageAdapter, InMemoryStorageAdapter} from "./StorageAdapter"
import {getPublicKey} from "nostr-tools"

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
  private ourDeviceInvites: Map<string, Invite> = new Map()

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

    // 2. Create or load our own invite
  }

  init() {
    const ourPublicKey = getPublicKey(this.ourIdentityKey)
    return this.storage
      .get<string>(`invite/${this.deviceId}`)
      .then((data) => {
        if (!data) return null
        const invite = Invite.deserialize(data)
        if (invite) {
          this.ourDeviceInvites.set(this.deviceId, invite)
          return invite
        }
      })
      .catch(() => null)
      .then(async (invite) => {
        if (invite) return invite
        const newInvite = Invite.createNew(ourPublicKey, this.deviceId)
        await this.storage.put(`invite/${this.deviceId}`, newInvite.serialize())
        const event = newInvite.getEvent()
        await this.nostrPublish(event)
        console.warn(
          "Created new invite for our device",
          this.deviceId,
          newInvite,
          ourPublicKey
        )
        return newInvite
      })
      .then((invite) => {
        this.ourDeviceInvites.set(this.deviceId, invite)

        this.ourDeviceInviteSubscription = invite.listen(
          this.ourIdentityKey,
          this.nostrSubscribe,
          async (session, inviteePubkey, deviceId) => {
            console.warn("GOT ACCEPTANCE FROM", deviceId)
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
          async () => {
            // TODO: Handle invites from our other devices
          }
        )
      })
  }

  setupUser(userPubkey: string) {
    const inviteSubscriptionId = `invite/${userPubkey}`

    if (this.inviteSubscriptions.has(inviteSubscriptionId)) {
      return
    }

    this.userRecords.set(userPubkey, {
      publicKey: userPubkey,
      devices: new Map(),
      foundInvites: new Map(),
    })

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
          })
      })
    )
  }

  async sendEvent(recipientIdentityKey: string, event: Partial<Rumor>): Promise<void[]> {
    const userRecord = this.userRecords.get(recipientIdentityKey)
    if (!userRecord) {
      console.warn("No user record for", recipientIdentityKey)
      return Promise.resolve([])
    }

    if (userRecord.devices.size !== userRecord.foundInvites.size) {
      await this.acceptInvitesFromUser(recipientIdentityKey)
    }

    return Promise.all(
      Array.from(userRecord.devices.values()).map(async (device) => {
        const {activeSession} = device
        if (!activeSession) {
          console.warn("No active session for device", device.deviceId)
          return
        }
        const {event: verifiedEvent} = activeSession.sendEvent(event)
        await this.nostrPublish(verifiedEvent)
      })
    )
  }
}
