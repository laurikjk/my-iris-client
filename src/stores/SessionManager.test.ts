import {describe, it, expect, vi} from "vitest"
import SessionManager from "./SessionManager"
import {generateSecretKey, getPublicKey} from "nostr-tools"
import {CHAT_MESSAGE_KIND} from "nostr-double-ratchet/src"
import {UserRecord} from "./UserRecord"
import type {Session} from "nostr-double-ratchet/src"

/**
 * Helper to create a lightweight stub that satisfies the parts of the Session
 * interface that SessionManager relies on (sendEvent, onEvent, close).
 */
function createStubSession() {
  const callbacks: ((event: any) => void)[] = []
  const stub: any = {
    name: "stub",
    state: {
      theirNextNostrPublicKey: "mock-their-next-key",
      ourCurrentNostrKey: {publicKey: "mock-our-current-key"},
    },
    sendEvent: vi.fn().mockImplementation((event: any) => {
      // Simulate returning an encrypted event wrapper
      return {event: {...event, id: "id-" + Math.random().toString(36).slice(2)}}
    }),
    onEvent: vi.fn().mockImplementation((cb: (event: any) => void) => {
      callbacks.push(cb)
      return () => {}
    }),
    close: vi.fn(),
    // Helper to emit an incoming event for tests
    _emit: (event: any) => {
      callbacks.forEach((cb) => cb(event))
    },
  }
  return stub as unknown as Session & {_emit: (event: any) => void}
}

describe("SessionManager", () => {
  const nostrSubscribe = vi.fn().mockReturnValue(() => {})
  const nostrPublish = vi.fn().mockResolvedValue({} as any)
  const ourIdentityKey = generateSecretKey()
  const deviceId = "test-device"

  it("should start listening and queue message when no active session exists", async () => {
    const manager = new SessionManager(
      ourIdentityKey,
      deviceId,
      nostrSubscribe,
      nostrPublish
    )
    const listenSpy = vi.spyOn(manager as any, "listenToUser")

    const sendPromise = manager.sendText("recipient", "hello")

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(listenSpy).toHaveBeenCalledWith("recipient")
  }, 1000)

  it("should send events to all active sessions", async () => {
    const manager = new SessionManager(
      ourIdentityKey,
      deviceId,
      nostrSubscribe,
      nostrPublish
    )

    const recipient = "recipientPubKey"
    const session = createStubSession()
    const testDeviceId = "test-device"
    const sessionId = `${recipient}:${testDeviceId}`

    // Store session in SessionManager and create UserRecord
    ;(manager as any).sessions.set(sessionId, session)
    const userRecord = new UserRecord(recipient, recipient)
    userRecord.upsertSession(testDeviceId, sessionId)
    ;(manager as any).userRecords.set(recipient, userRecord)

    const results = await manager.sendText(recipient, "hello")

    expect(session.sendEvent).toHaveBeenCalledTimes(1)
    expect(session.sendEvent).toHaveBeenCalledWith({
      kind: CHAT_MESSAGE_KIND,
      content: "hello",
    })
    expect(results).toHaveLength(1)
  })

  it("should propagate incoming session events to listeners", () => {
    const manager = new SessionManager(
      ourIdentityKey,
      deviceId,
      nostrSubscribe,
      nostrPublish
    )

    const recipient = "recipientPubKey"
    const session = createStubSession()
    const testDeviceId = "test-device"
    const sessionId = `${recipient}:${testDeviceId}`

    // Store session in SessionManager and create UserRecord
    ;(manager as any).sessions.set(sessionId, session)
    const userRecord = new UserRecord(recipient, recipient)
    userRecord.upsertSession(testDeviceId, sessionId)
    ;(manager as any).userRecords.set(recipient, userRecord)

    const received: any[] = []
    manager.onEvent((e) => received.push(e))

    const testEvent = {content: "incoming"}
    ;(session as any)._emit(testEvent)
    expect(received).toHaveLength(1)
    expect(received[0]).toBe(testEvent)
  })

  it("should create and track own device sessions", () => {
    const manager = new SessionManager(
      ourIdentityKey,
      deviceId,
      nostrSubscribe,
      nostrPublish
    )
    const ourPublicKey = getPublicKey(ourIdentityKey)

    // Create a session for our own device
    const session = createStubSession()
    const testDeviceId = "test-device"
    const sessionId = `${ourPublicKey}:${testDeviceId}`

    // Store session in SessionManager and create UserRecord
    ;(manager as any).sessions.set(sessionId, session)
    const userRecord = new UserRecord(ourPublicKey, ourPublicKey)
    userRecord.upsertSession(testDeviceId, sessionId)
    ;(manager as any).userRecords.set(ourPublicKey, userRecord)

    // Verify the session is tracked
    const record = (manager as any).userRecords.get(ourPublicKey)
    expect(record).toBeDefined()
    const sessionIds = record.getActiveSessionIds()
    expect(sessionIds).toHaveLength(1)
    expect(sessionIds[0]).toBe(sessionId)
    // Verify the session is accessible via SessionManager
    const sessionFromManager = (manager as any).sessions.get(sessionIds[0])
    expect(sessionFromManager).toBe(session)
  })

  it("should remove own device session", () => {
    const manager = new SessionManager(
      ourIdentityKey,
      deviceId,
      nostrSubscribe,
      nostrPublish
    )
    const ourPublicKey = getPublicKey(ourIdentityKey)

    // Create a session for our own device
    const session = createStubSession()
    const testDeviceId = "test-device"
    const sessionId = `${ourPublicKey}:${testDeviceId}`

    // Store session in SessionManager and create UserRecord
    ;(manager as any).sessions.set(sessionId, session)
    const userRecord = new UserRecord(ourPublicKey, ourPublicKey)
    userRecord.upsertSession(testDeviceId, sessionId)
    ;(manager as any).userRecords.set(ourPublicKey, userRecord)

    // Remove the session from UserRecord
    userRecord.deleteSession(testDeviceId)

    // Verify the session is no longer active in UserRecord
    const record = (manager as any).userRecords.get(ourPublicKey)
    const activeSessionIds = record.getActiveSessionIds()
    expect(activeSessionIds).toHaveLength(0)

    // Session should still exist in SessionManager until explicitly removed
    const sessionFromManager = (manager as any).sessions.get(sessionId)
    expect(sessionFromManager).toBe(session)
  })

  it("should track multiple own device sessions", () => {
    const manager = new SessionManager(
      ourIdentityKey,
      deviceId,
      nostrSubscribe,
      nostrPublish
    )
    const ourPublicKey = getPublicKey(ourIdentityKey)

    // Create sessions for two of our devices
    const session1 = createStubSession()
    const session2 = createStubSession()
    const sessionId1 = `${ourPublicKey}:device-1`
    const sessionId2 = `${ourPublicKey}:device-2`

    // Store sessions in SessionManager and create UserRecord
    ;(manager as any).sessions.set(sessionId1, session1)
    ;(manager as any).sessions.set(sessionId2, session2)
    const userRecord = new UserRecord(ourPublicKey, ourPublicKey)
    userRecord.upsertSession("device-1", sessionId1)
    userRecord.upsertSession("device-2", sessionId2)
    ;(manager as any).userRecords.set(ourPublicKey, userRecord)

    // Verify both sessions are tracked as active (one per device)
    const record = (manager as any).userRecords.get(ourPublicKey)
    const activeSessionIds = record.getActiveSessionIds()
    expect(activeSessionIds).toHaveLength(2)
    expect(activeSessionIds).toContain(sessionId1)
    expect(activeSessionIds).toContain(sessionId2)

    // Verify sessions are accessible via SessionManager
    expect((manager as any).sessions.get(sessionId1)).toBe(session1)
    expect((manager as any).sessions.get(sessionId2)).toBe(session2)
  })

  it("should emit sent messages to onEvent listeners", async () => {
    const manager = new SessionManager(
      ourIdentityKey,
      deviceId,
      nostrSubscribe,
      nostrPublish
    )

    const recipient = "recipientPubKey"
    const session = createStubSession()
    const testDeviceId = "test-device"
    const sessionId = `${recipient}:${testDeviceId}`

    // Store session in SessionManager and create UserRecord
    ;(manager as any).sessions.set(sessionId, session)
    const userRecord = new UserRecord(recipient, recipient)
    userRecord.upsertSession(testDeviceId, sessionId)
    ;(manager as any).userRecords.set(recipient, userRecord)

    const received: any[] = []
    manager.onEvent((e) => received.push(e))

    await manager.sendText(recipient, "hello-self")

    expect(received.some((e) => e.content === "hello-self")).toBe(true)
  })
})
