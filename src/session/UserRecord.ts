import {NostrSubscribe, NostrPublish, Invite, Session} from "nostr-double-ratchet"
import {DeviceRecord} from "./DeviceRecord"
import {StorageAdapter} from "./StorageAdapter"

export class UserRecord {
  private deviceRecords: Map<string, DeviceRecord> = new Map()
  private unsubscribe: (() => void) | null = null
  private isStale: boolean = false
  private staleTimestamp?: number

  constructor(
    public readonly userPublicKey: string,
    private readonly ourPrivateKey: Uint8Array,
    private readonly ourDeviceId: string,
    private readonly nostrSubscribe: NostrSubscribe,
    private readonly nostrPublish: NostrPublish,
    private readonly storageAdapter: StorageAdapter
  ) {
    this.loadInvites()
  }

  private async loadInvites() {
    const storedDeviceRecords = await this.storageAdapter.list(
      `user/${this.userPublicKey}/device/`
    )
    for (const str of storedDeviceRecords) {
      const record = JSON.parse(str)
      const deviceRecord = new DeviceRecord(
        record.deviceId,
        new Session(this.nostrSubscribe, record.sessionState),
        this.nostrSubscribe,
        this.nostrPublish,
        this.storageAdapter
      )
      this.deviceRecords.set(record.deviceId, deviceRecord)
    }

    const unsubscribe = Invite.fromUser(
      this.userPublicKey,
      this.nostrSubscribe,
      async (invite) => {
        try {
          const {deviceId} = invite

          const isOurInvite = deviceId === this.ourDeviceId
          const isExistingDevice = deviceId && this.deviceRecords.has(deviceId)
          if (!deviceId || isOurInvite || isExistingDevice) {
            return
          }

          const {session, event} = await invite.accept(
            this.nostrSubscribe,
            this.userPublicKey,
            this.ourPrivateKey
          )
          await this.nostrPublish(event)
          const deviceRecord = new DeviceRecord(
            deviceId,
            session,
            this.nostrSubscribe,
            this.nostrPublish,
            this.storageAdapter
          )
          this.deviceRecords.set(deviceId, deviceRecord)
        } catch (e) {
          console.error("Failed to process invite:", e)
        }
      }
    )
    this.unsubscribe = unsubscribe
  }
}
