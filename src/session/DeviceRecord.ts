import {Session, NostrSubscribe, NostrPublish} from "nostr-double-ratchet"
import {StorageAdapter} from "./StorageAdapter"

export class DeviceRecord {
  private activeSession?: Session
  private inactiveSessions: Session[] = []
  private staleTimestamp?: number

  constructor(
    public readonly deviceId: string,
    public readonly session: Session,
    private readonly nostrSubscribe: NostrSubscribe,
    private readonly nostrPublish: NostrPublish,
    private readonly storageAdapter: StorageAdapter
  ) {}
}
