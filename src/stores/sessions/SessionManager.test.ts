/* eslint-disable @typescript-eslint/no-explicit-any */

import {describe, expect, it, beforeEach, afterEach, vi} from "vitest"
import {SessionManager, SessionManagerConfig, StorageAdapter} from "./SessionManager"
import {Filter, VerifiedEvent} from "nostr-tools"

// Mock dependencies
vi.mock("@/shared/utils/PublicKey")
vi.mock("@/utils/nostrCrypto")
vi.mock("nostr-double-ratchet/src")

describe("SessionManager", () => {
  let mockStorage: StorageAdapter
  let mockSubscribe: ReturnType<
    typeof vi.fn<[Filter, (event: VerifiedEvent) => void], () => void>
  >
  let mockPublishEvent: ReturnType<typeof vi.fn<[unknown], Promise<void>>>
  let mockEncrypt: ReturnType<typeof vi.fn<[string, string], Promise<string>>>
  let config: SessionManagerConfig
  let sessionManager: SessionManager

  beforeEach(async () => {
    // Mock storage adapter
    mockStorage = {
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
    }

    // Mock subscribe function
    mockSubscribe = vi.fn().mockReturnValue(() => {})

    // Mock publish function
    mockPublishEvent = vi.fn().mockResolvedValue(undefined)

    // Mock encrypt function
    mockEncrypt = vi.fn().mockResolvedValue("encrypted_data")

    // Mock getEncryptFunction
    const cryptoModule = (await vi.importMock("@/utils/nostrCrypto")) as any
    cryptoModule.getEncryptFunction.mockReturnValue(mockEncrypt)

    // Mock PublicKey
    const publicKeyModule = (await vi.importMock("@/shared/utils/PublicKey")) as any
    publicKeyModule.PublicKey.mockImplementation((pubkey: string) => ({
      toString: () => pubkey,
    }))

    config = {
      myPublicKey: "test_public_key",
      myPrivateKey: "test_private_key",
      storageAdapter: mockStorage,
      subscribe: mockSubscribe,
      publishEvent: mockPublishEvent,
    }

    sessionManager = new SessionManager(config)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("constructor", () => {
    it("should initialize with provided config", () => {
      expect(sessionManager).toBeInstanceOf(SessionManager)
    })

    it("should set up encryption function", async () => {
      const cryptoModule = (await vi.importMock("@/utils/nostrCrypto")) as any
      expect(cryptoModule.getEncryptFunction).toHaveBeenCalledWith("test_private_key")
    })
  })

  describe("invite handling", () => {
    let mockInvite: {
      inviter: string
      deviceId?: string
      accept: ReturnType<
        typeof vi.fn<[], Promise<{session: {state: unknown}; event: {id: string}}>>
      >
    }
    let mockSession: {state: unknown}
    let mockFromUser: ReturnType<
      typeof vi.fn<[string, unknown, (invite: unknown) => void], () => void>
    >

    beforeEach(async () => {
      mockSession = {
        state: {some: "session_state"},
      }

      mockInvite = {
        inviter: "inviter_pubkey",
        deviceId: "device123",
        accept: vi.fn().mockResolvedValue({
          session: mockSession,
          event: {id: "event123"},
        }),
      }

      mockFromUser = vi.fn()
      const inviteModule = (await vi.importMock("nostr-double-ratchet/src")) as any
      inviteModule.Invite.fromUser = mockFromUser
      inviteModule.serializeSessionState.mockReturnValue("serialized_session_state")
    })

    it("should listen to user invites and store sessions on acceptance", async () => {
      // Setup fromUser to call the callback immediately
      mockFromUser.mockImplementation(
        (pubkey: string, subscribe: unknown, callback: (invite: unknown) => void) => {
          callback(mockInvite)
          return () => {} // unsubscribe function
        }
      )

      // Call the private method using reflection
      const listenMethod = (
        sessionManager as {listenToUserInvites: (userPubKey: string) => Promise<void>}
      ).listenToUserInvites
      await listenMethod.call(sessionManager, "test_user_pubkey")

      expect(mockFromUser).toHaveBeenCalledWith(
        "test_public_key",
        mockSubscribe,
        expect.any(Function)
      )
      expect(mockInvite.accept).toHaveBeenCalled()

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        "session:inviter_pubkey:device123",
        "serialized_session_state"
      )
    })

    it("should not store session if invite has no deviceId", async () => {
      const inviteWithoutDevice = {
        ...mockInvite,
        deviceId: undefined,
      }

      mockFromUser.mockImplementation(
        (pubkey: string, subscribe: unknown, callback: (invite: unknown) => void) => {
          callback(inviteWithoutDevice)
          return () => {}
        }
      )

      const listenMethod = (
        sessionManager as {listenToUserInvites: (userPubKey: string) => Promise<void>}
      ).listenToUserInvites
      await listenMethod.call(sessionManager, "test_user_pubkey")

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockStorage.setItem).not.toHaveBeenCalled()
    })

    it("should store unsubscribe function for cleanup", async () => {
      const mockUnsub = vi.fn()
      mockFromUser.mockReturnValue(mockUnsub)

      const listenMethod = (
        sessionManager as {listenToUserInvites: (userPubKey: string) => Promise<void>}
      ).listenToUserInvites
      await listenMethod.call(sessionManager, "test_user_pubkey")

      const inviteUnsubs = (sessionManager as {inviteUnsubs: Map<string, () => void>})
        .inviteUnsubs
      expect(inviteUnsubs.get("test_user_pubkey")).toBe(mockUnsub)
    })
  })

  describe("storage integration", () => {
    it("should use provided storage adapter", () => {
      expect(mockStorage.setItem).toHaveBeenCalledTimes(0) // Initially no calls
    })
  })

  describe("multiple sessions", () => {
    it("should handle multiple invite acceptances and store them separately", async () => {
      const mockInvite1 = {
        inviter: "inviter1",
        deviceId: "device1",
        accept: vi.fn().mockResolvedValue({
          session: {state: {session: "state1"}},
          event: {id: "event1"},
        }),
      }

      const mockInvite2 = {
        inviter: "inviter2",
        deviceId: "device2",
        accept: vi.fn().mockResolvedValue({
          session: {state: {session: "state2"}},
          event: {id: "event2"},
        }),
      }

      const inviteModule = (await vi.importMock("nostr-double-ratchet/src")) as any
      inviteModule.serializeSessionState
        .mockReturnValueOnce("serialized_state1")
        .mockReturnValueOnce("serialized_state2")

      // Mock fromUser to call callback with both invites
      inviteModule.Invite.fromUser.mockImplementation(
        (pubkey: string, subscribe: unknown, callback: (invite: unknown) => void) => {
          callback(mockInvite1)
          callback(mockInvite2)
          return () => {}
        }
      )

      const listenMethod = (
        sessionManager as {listenToUserInvites: (userPubKey: string) => Promise<void>}
      ).listenToUserInvites
      await listenMethod.call(sessionManager, "test_user_pubkey")

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        "session:inviter1:device1",
        "serialized_state1"
      )
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        "session:inviter2:device2",
        "serialized_state2"
      )
      expect(mockStorage.setItem).toHaveBeenCalledTimes(2)
    })
  })
})
