import {Session, NostrSubscribe} from "nostr-double-ratchet"
import {DeviceRecord} from "./DeviceRecord"
import {StorageAdapter} from "./StorageAdapter"
import {NostrPublish} from "nostr-double-ratchet/src"

/**
 * Manages sessions for a single user across multiple devices
 * Structure: UserRecord → DeviceRecord → Sessions
 */
export class UserRecord {
  private deviceRecords: Map<string, DeviceRecord> = new Map()
  private isStale: boolean = false
  private staleTimestamp?: number

  constructor(
    public readonly userId: string,
    private readonly nostrSubscribe: NostrSubscribe,
    private readonly nostrPublish: NostrPublish,
    private readonly storageAdapter: StorageAdapter
  ) {}

  public upsertDevice(deviceId: string, publicKey: string) {}

  public removeDevice(deviceId: string) {}
}
