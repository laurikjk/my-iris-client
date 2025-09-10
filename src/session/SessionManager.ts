import {NostrSubscribe, NostrPublish, Rumor, Invite} from "nostr-double-ratchet"
import {StorageAdapter, InMemoryStorageAdapter} from "./StorageAdapter"
import {UserRecord} from "./UserRecord"
import {getPublicKey} from "nostr-tools"

export type OnEventCallback = (event: Rumor, from: string) => void

export default class SessionManager {
  private userRecords: Map<string, UserRecord> = new Map()
  private eventCallbacks: Set<OnEventCallback> = new Set()
  private invite?: Invite
  private _initialised = false

  constructor(
    private ourIdentityKey: Uint8Array,
    private deviceId: string,
    private nostrSubscribe: NostrSubscribe,
    private nostrPublish: NostrPublish,
    private storage: StorageAdapter = new InMemoryStorageAdapter()
  ) {}

  async sendToUser(userPubkey: string, event: Partial<Rumor>): Promise<void> {
    let userRecord = this.userRecords.get(userPubkey)
    if (!userRecord) {
      userRecord = new UserRecord(
        userPubkey,
        this.ourIdentityKey,
        this.deviceId,
        this.nostrSubscribe,
        this.nostrPublish,
        this.storage
      )
      this.userRecords.set(userPubkey, userRecord)
      this.setupUserEventHandling(userRecord, userPubkey)
    }
    await userRecord.sendToAllDevices(event)
  }

  onEvent(callback: OnEventCallback): () => void {
    this.eventCallbacks.add(callback)
    return () => this.eventCallbacks.delete(callback)
  }

  async init(): Promise<void> {
    if (this._initialised) return

    const ourPublicKey = getPublicKey(this.ourIdentityKey)

    // Load existing user records from storage
    await this.loadUserRecords()

    // Create or load our own invite
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
      await this.storage.put(`invite/${this.deviceId}`, invite.serialize()).catch(() => {})
    }
    this.invite = invite

    // Publish our own invite
    const event = invite.getEvent()
    this.nostrPublish(event).catch((e) => console.error("Failed to publish invite", e))

    this._initialised = true
  }

  close(): void {
    for (const userRecord of this.userRecords.values()) {
      // UserRecord should have its own close method
    }
    this.userRecords.clear()
    this.eventCallbacks.clear()
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

  private async loadUserRecords() {
    try {
      const sessionKeys = await this.storage.list("session/")
      const userPubkeys = new Set<string>()

      for (const key of sessionKeys) {
        const parts = key.split('/')
        if (parts.length >= 2) {
          const userPubkey = parts[1]
          userPubkeys.add(userPubkey)
        }
      }

      for (const userPubkey of userPubkeys) {
        const userRecord = new UserRecord(
          userPubkey,
          this.ourIdentityKey,
          this.deviceId,
          this.nostrSubscribe,
          this.nostrPublish,
          this.storage
        )
        this.userRecords.set(userPubkey, userRecord)
        this.setupUserEventHandling(userRecord, userPubkey)
      }
    } catch (e) {
      console.error("Failed to load user records:", e)
    }
  }

  private setupUserEventHandling(userRecord: UserRecord, userPubkey: string) {
    userRecord.onEvent((event: Rumor) => {
      this.eventCallbacks.forEach(callback => callback(event, userPubkey))
    })
  }
}