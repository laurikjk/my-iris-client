import {
  Session,
  NostrSubscribe,
  NostrPublish,
  Rumor,
  serializeSessionState,
  deserializeSessionState,
} from "nostr-double-ratchet"
import {StorageAdapter} from "./StorageAdapter"

interface DeviceRecordDependencies {
  nostrSubscribe: NostrSubscribe
  nostrPublish: NostrPublish
  storageAdapter: StorageAdapter
}

export class DeviceRecord {
  private activeSession?: Session
  private inactiveSessions: Session[] = []
  private staleTimestamp?: number
  private eventCallbacks: Set<(event: Rumor) => void> = new Set()

  private constructor(
    public readonly deviceId: string,
    public readonly userPubkey: string,
    activeSession: Session | null,
    inactiveSessions: Session[],
    staleTimestamp: number | undefined,
    private readonly dependencies: DeviceRecordDependencies
  ) {
    this.activeSession = activeSession || undefined
    this.inactiveSessions = inactiveSessions
    this.staleTimestamp = staleTimestamp

    // Setup session message handling
    if (this.activeSession) {
      this.activeSession.onEvent((event: Rumor) => {
        // Forward to all registered callbacks
        this.eventCallbacks.forEach(callback => callback(event))
        
        // Persist session state after receive (async, don't block)
        const activeSessionKey = `session/${this.userPubkey}/${this.deviceId}/active`
        const sessionData = serializeSessionState(this.activeSession!.state)
        this.dependencies.storageAdapter.put(activeSessionKey, sessionData).catch(() => {})
      })
    }
  }

  static async fromStorage(
    deviceId: string,
    userPubkey: string,
    dependencies: DeviceRecordDependencies
  ): Promise<DeviceRecord | null> {
    const activeSessionKey = `session/${userPubkey}/${deviceId}/active`
    let activeSession: Session | null = null
    try {
      const sessionData = await dependencies.storageAdapter.get<string>(activeSessionKey)
      if (sessionData) {
        const sessionState = deserializeSessionState(sessionData)
        activeSession = new Session(dependencies.nostrSubscribe, sessionState)
      }
    } catch {}

    if (!activeSession) {
      return null
    }

    const inactiveSessions: Session[] = []
    let index = 0
    try {
      while (true) {
        const inactiveSessionKey = `session/${userPubkey}/${deviceId}/inactive/${index}`
        const sessionData =
          await dependencies.storageAdapter.get<string>(inactiveSessionKey)
        if (!sessionData) break

        const sessionState = deserializeSessionState(sessionData)
        inactiveSessions.push(new Session(dependencies.nostrSubscribe, sessionState))
        index++
      }
    } catch {
      // Stop loading on error
    }

    const metadataKey = `device/${userPubkey}/${deviceId}/metadata`
    let staleTimestamp: number | undefined
    try {
      const metadataStr = await dependencies.storageAdapter.get<string>(metadataKey)
      if (metadataStr) {
        const metadata = JSON.parse(metadataStr)
        staleTimestamp = metadata.staleTimestamp
      }
    } catch {}

    return new DeviceRecord(
      deviceId,
      userPubkey,
      activeSession,
      inactiveSessions,
      staleTimestamp,
      dependencies
    )
  }

  static async fromSession(
    deviceId: string,
    userPubkey: string,
    session: Session,
    dependencies: DeviceRecordDependencies
  ): Promise<DeviceRecord> {
    const instance = new DeviceRecord(
      deviceId,
      userPubkey,
      session,
      [],
      undefined,
      dependencies
    )

    const activeSessionKey = `session/${userPubkey}/${deviceId}/active`
    const metadataKey = `device/${userPubkey}/${deviceId}/metadata`

    try {
      const sessionData = serializeSessionState(session.state)
      await dependencies.storageAdapter.put(activeSessionKey, sessionData)

      const metadata = {
        deviceId,
        userPubkey,
        staleTimestamp: undefined,
      }
      await dependencies.storageAdapter.put(metadataKey, JSON.stringify(metadata))
    } catch (err) {
      console.error(`Failed to persist new session for ${deviceId}:`, err)
    }

    return instance
  }

  async sendMessage(event: Partial<Rumor>): Promise<void> {
    if (!this.activeSession) {
      throw new Error(`No active session for device ${this.deviceId}`)
    }
    
    const {event: encryptedEvent} = this.activeSession.sendEvent(event)
    await this.dependencies.nostrPublish(encryptedEvent)
    
    // Persist session state after send
    const activeSessionKey = `session/${this.userPubkey}/${this.deviceId}/active`
    const sessionData = serializeSessionState(this.activeSession.state)
    await this.dependencies.storageAdapter.put(activeSessionKey, sessionData)
  }

  onEvent(callback: (event: Rumor) => void): () => void {
    this.eventCallbacks.add(callback)
    return () => this.eventCallbacks.delete(callback)
  }
}
