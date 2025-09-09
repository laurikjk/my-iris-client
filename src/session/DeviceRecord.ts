import {Session, NostrSubscribe, NostrPublish} from "nostr-double-ratchet"

interface DeviceRecord {
  deviceId: string
  publicKey: string
  activeSession?: Session
  inactiveSessions: Session[]
  isStale: boolean
  staleTimestamp?: number
  lastActivity?: number
}

export class DeviceRecord {
  constructor(
    public readonly deviceId: string,
    private readonly nostrSubscribe: NostrSubscribe,
    private readonly nostrPublish: NostrPublish
  ) {}
}
