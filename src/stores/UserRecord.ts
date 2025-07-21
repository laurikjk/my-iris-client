import {
  Session,
  serializeSessionState,
  deserializeSessionState,
} from "nostr-double-ratchet/src"
import {ndk} from "@/utils/ndk"

// Helper subscribe implementation for Session reconstruction
const sessionSubscribe = (
  filter: any,
  onEvent: (event: any) => void,
): (() => void) => {
  console.log("sessionSubscribe called with filter:", filter)
  const sub = ndk().subscribe(filter)
  sub.on("event", (e: unknown) => {
    console.log("sessionSubscribe received event:", {
      id: (e as any)?.id,
      kind: (e as any)?.kind,
      pubkey: (e as any)?.pubkey,
      authors: filter?.authors,
      filterMatch: filter?.authors?.includes((e as any)?.pubkey),
      kindMatch: filter?.kinds?.includes((e as any)?.kind),
    })
    onEvent(e as any)
  })
  return () => {
    console.log("sessionSubscribe unsubscribing from filter:", filter)
    sub.stop()
  }
}

export interface DeviceRecord {
  deviceId: string
  activeSession?: Session
  inactiveSessions: Session[]
  isStale: boolean
  staleTimestamp?: number
  lastActivity?: number
}

/**
 * Manages sessions for a single user across multiple devices
 * Structure: UserRecord → DeviceRecord → Sessions
 * Designed for iris-client's messaging system
 */
export class UserRecord {
  private deviceRecords: Map<string, DeviceRecord> = new Map()
  private isStale: boolean = false
  private staleTimestamp?: number

  constructor(
    public readonly userId: string,
    public readonly publicKey: string
  ) {}

  // ============================================================================
  // Device Management
  // ============================================================================

  /**
   * Creates or updates a device record for this user
   */
  public upsertDevice(deviceId: string): DeviceRecord {
    let record = this.deviceRecords.get(deviceId)

    if (!record) {
      record = {
        deviceId,
        inactiveSessions: [],
        isStale: false,
        lastActivity: Date.now(),
      }
      this.deviceRecords.set(deviceId, record)
    }

    return record
  }

  /**
   * Gets a device record by deviceId
   */
  public getDevice(deviceId: string): DeviceRecord | undefined {
    return this.deviceRecords.get(deviceId)
  }

  /**
   * Gets all device records for this user
   */
  public getAllDevices(): DeviceRecord[] {
    return Array.from(this.deviceRecords.values())
  }

  /**
   * Gets all active (non-stale) device records
   */
  public getActiveDevices(): DeviceRecord[] {
    if (this.isStale) return []
    return Array.from(this.deviceRecords.values()).filter((device) => !device.isStale)
  }

  /**
   * Removes a device record and closes all its sessions
   */
  public removeDevice(deviceId: string): boolean {
    const record = this.deviceRecords.get(deviceId)
    if (!record) return false

    // Close all sessions for this device
    record.activeSession?.close()
    record.inactiveSessions.forEach((session) => session.close())

    return this.deviceRecords.delete(deviceId)
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Adds or updates a session for a specific device
   */
  public upsertSession(deviceId: string, session: Session): void {
    const device = this.upsertDevice(deviceId)

    // If there's an active session, move it to inactive
    if (device.activeSession) {
      device.inactiveSessions.unshift(device.activeSession)
    }

    // Set the new session as active
    session.name = deviceId // Ensure session name matches deviceId
    device.activeSession = session
    device.lastActivity = Date.now()
  }

  /**
   * Gets the active session for a specific device
   */
  public getActiveSession(deviceId: string): Session | undefined {
    const device = this.deviceRecords.get(deviceId)
    return device?.isStale ? undefined : device?.activeSession
  }

  /**
   * Gets all sessions (active + inactive) for a specific device
   */
  public getDeviceSessions(deviceId: string): Session[] {
    const device = this.deviceRecords.get(deviceId)
    if (!device) return []

    const sessions: Session[] = []
    if (device.activeSession) {
      sessions.push(device.activeSession)
    }
    sessions.push(...device.inactiveSessions)
    return sessions
  }

  /**
   * Gets all active sessions across all devices for this user
   */
  public getActiveSessions(): Session[] {
    const sessions: Session[] = []

    for (const device of this.getActiveDevices()) {
      if (device.activeSession) {
        sessions.push(device.activeSession)
      }
    }

    // Sort by ability to send messages (prioritize ready sessions)
    sessions.sort((a, b) => {
      const aCanSend = !!(a.state?.theirNextNostrPublicKey && a.state?.ourCurrentNostrKey)
      const bCanSend = !!(b.state?.theirNextNostrPublicKey && b.state?.ourCurrentNostrKey)

      if (aCanSend && !bCanSend) return -1
      if (!aCanSend && bCanSend) return 1
      return 0
    })

    return sessions
  }

  /**
   * Gets all sessions (active + inactive) across all devices
   */
  public getAllSessions(): Session[] {
    const sessions: Session[] = []

    for (const device of this.deviceRecords.values()) {
      if (device.activeSession) {
        sessions.push(device.activeSession)
      }
      sessions.push(...device.inactiveSessions)
    }

    return sessions
  }

  /**
   * Gets session IDs in the format used by iris-client (userPubKey:deviceId)
   */
  public getSessionIds(): string[] {
    const sessionIds: string[] = []

    for (const device of this.getActiveDevices()) {
      if (device.activeSession) {
        sessionIds.push(`${this.userId}:${device.deviceId}`)
      }
    }

    return sessionIds
  }

  // ============================================================================
  // Stale Management
  // ============================================================================

  /**
   * Marks a specific device as stale
   */
  public markDeviceStale(deviceId: string): void {
    const device = this.deviceRecords.get(deviceId)
    if (device) {
      device.isStale = true
      device.staleTimestamp = Date.now()
    }
  }

  /**
   * Marks the entire user record as stale
   */
  public markUserStale(): void {
    this.isStale = true
    this.staleTimestamp = Date.now()
  }

  /**
   * Removes stale devices and sessions older than maxLatency
   */
  public pruneStaleRecords(maxLatency: number): void {
    const now = Date.now()

    // Remove stale devices
    for (const [deviceId, device] of this.deviceRecords.entries()) {
      if (
        device.isStale &&
        device.staleTimestamp &&
        now - device.staleTimestamp > maxLatency
      ) {
        this.removeDevice(deviceId)
      }
    }

    // Remove entire user record if stale
    if (this.isStale && this.staleTimestamp && now - this.staleTimestamp > maxLatency) {
      this.close()
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Gets the most recently active device
   */
  public getMostActiveDevice(): DeviceRecord | undefined {
    const activeDevices = this.getActiveDevices()
    if (activeDevices.length === 0) return undefined

    return activeDevices.reduce((most, current) => {
      const mostActivity = most.lastActivity || 0
      const currentActivity = current.lastActivity || 0
      return currentActivity > mostActivity ? current : most
    })
  }

  /**
   * Gets the preferred session (from most active device)
   */
  public getPreferredSession(): Session | undefined {
    const mostActive = this.getMostActiveDevice()
    return mostActive?.activeSession
  }

  /**
   * Gets the preferred session ID for iris-client routing
   */
  public getPreferredSessionId(): string | null {
    const mostActive = this.getMostActiveDevice()
    if (!mostActive?.activeSession) return null
    return `${this.userId}:${mostActive.deviceId}`
  }

  /**
   * Checks if this user has any active sessions
   */
  public hasActiveSessions(): boolean {
    return this.getActiveSessions().length > 0
  }

  /**
   * Gets total count of devices
   */
  public getDeviceCount(): number {
    return this.deviceRecords.size
  }

  /**
   * Gets total count of active sessions
   */
  public getActiveSessionCount(): number {
    return this.getActiveSessions().length
  }

  /**
   * Updates last activity for a device
   */
  public updateDeviceActivity(deviceId: string): void {
    const device = this.deviceRecords.get(deviceId)
    if (device) {
      device.lastActivity = Date.now()
    }
  }

  /**
   * Deletes a session from a specific device
   */
  public deleteSession(deviceId: string): void {
    const device = this.deviceRecords.get(deviceId)
    if (device && device.activeSession) {
      device.activeSession.close()
      device.activeSession = undefined

      // If there are inactive sessions, activate the most recent one
      if (device.inactiveSessions.length > 0) {
        device.activeSession = device.inactiveSessions.shift()
      }
    }
  }

  /**
   * Gets total number of sessions across all devices
   */
  public getTotalSessionCount(): number {
    return this.getAllSessions().length
  }

  /**
   * Serializes the UserRecord for persistence
   */
  public serialize(): string {
    const data = {
      userId: this.userId,
      publicKey: this.publicKey,
      isStale: this.isStale,
      staleTimestamp: this.staleTimestamp,
      devices: Array.from(this.deviceRecords.values()).map((device) => ({
        deviceId: device.deviceId,
        isStale: device.isStale,
        staleTimestamp: device.staleTimestamp,
        lastActivity: device.lastActivity,
        activeSession: device.activeSession
          ? {
              state: serializeSessionState(device.activeSession.state),
            }
          : null,
        inactiveSessions: device.inactiveSessions.map((session) => ({
          state: serializeSessionState(session.state),
        })),
      })),
    }
    return JSON.stringify(data)
  }

  /**
   * Deserializes the UserRecord from persistence, reconstructing sessions
   */
  public deserialize(serializedData: string): void {
    const data = JSON.parse(serializedData)
    this.isStale = data.isStale || false
    this.staleTimestamp = data.staleTimestamp

    this.deviceRecords.clear()

    data.devices?.forEach((deviceData: any) => {
      const device: DeviceRecord = {
        deviceId: deviceData.deviceId,
        isStale: deviceData.isStale || false,
        staleTimestamp: deviceData.staleTimestamp,
        lastActivity: deviceData.lastActivity,
        inactiveSessions: [],
        activeSession: undefined,
      }

      // Reconstruct active session
      if (deviceData.activeSession?.state) {
        try {
          const state = deserializeSessionState(deviceData.activeSession.state)
          device.activeSession = new Session(sessionSubscribe, state)
        } catch (e) {
          console.warn("Failed to deserialize active session", e)
        }
      }

      // Reconstruct inactive sessions
      deviceData.inactiveSessions?.forEach((s: any) => {
        try {
          const state = deserializeSessionState(s.state)
          const session = new Session(sessionSubscribe, state)
          device.inactiveSessions.push(session)
        } catch (e) {
          console.warn("Failed to deserialize inactive session", e)
        }
      })

      this.deviceRecords.set(device.deviceId, device)
    })
  }

  /**
   * Sets up event listeners on all sessions
   */
  public onAllSessions(
    callback: (event: unknown, sessionId: string) => void
  ): () => void {
    const unsubscribers: (() => void)[] = []

    for (const device of this.deviceRecords.values()) {
      if (device.activeSession) {
        const sessionId = this.createSessionId(device.deviceId)
        const unsubscribe = device.activeSession.onEvent?.((event: unknown) => {
          callback(event, sessionId)
        })
        if (unsubscribe) {
          unsubscribers.push(unsubscribe)
        }
      }
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }

  /**
   * Gets a session by device ID
   */
  public getSession(deviceId: string): Session | undefined {
    return this.getActiveSession(deviceId)
  }

  /**
   * Gets the active session from the preferred device
   */
  public getPreferredSessionForSending(): Session | undefined {
    return this.getPreferredSession()
  }

  /**
   * Cleanup when destroying the user record
   */
  public close(): void {
    for (const device of this.deviceRecords.values()) {
      device.activeSession?.close()
      device.inactiveSessions.forEach((session) => session.close())
    }
    this.deviceRecords.clear()
  }

  // ============================================================================
  // Iris-Client Integration Methods
  // ============================================================================

  /**
   * Creates session ID from device ID (for iris-client compatibility)
   */
  public createSessionId(deviceId: string): string {
    return `${this.userId}:${deviceId}`
  }

  /**
   * Parses session ID to get device ID
   */
  public static parseSessionId(sessionId: string): {
    userPubKey: string
    deviceId: string
  } {
    const [userPubKey, deviceId] = sessionId.split(":")
    return {userPubKey, deviceId: deviceId || "unknown"}
  }

  /**
   * Creates a new session for a device
   */
  public createSession(
    deviceId: string,
    sharedSecret: Uint8Array,
    ourCurrentPrivateKey: Uint8Array,
    isInitiator: boolean,
    name?: string
  ): Session {
    const device = this.getDevice(deviceId)
    if (!device) {
      throw new Error(`No device record found for ${deviceId}`)
    }

    const session = Session.init(
      // We'd need to pass the subscribe function here, but since this is iris-client specific,
      // we'll handle session creation in the sessions store instead
      () => () => {}, // placeholder subscribe function
      this.publicKey, // Use the user's public key
      ourCurrentPrivateKey,
      isInitiator,
      sharedSecret,
      name || deviceId
    )

    this.upsertSession(deviceId, session)
    return session
  }

  // ============================================================================
  // Legacy Compatibility (for gradual migration)
  // ============================================================================

  /**
   * @deprecated Use upsertDevice instead
   */
  public conditionalUpdate(deviceId: string): void {
    this.upsertDevice(deviceId)
  }

  /**
   * Legacy method for compatibility with existing code
   */
  public upsertSessionLegacy(sessionId: string, session: Session): void {
    const {deviceId} = UserRecord.parseSessionId(sessionId)
    this.upsertSession(deviceId, session)
  }
}
