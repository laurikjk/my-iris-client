import {vi} from "vitest"
import SessionManager from "../../SessionManager"
import {
  Filter,
  generateSecretKey,
  getPublicKey,
  UnsignedEvent,
  VerifiedEvent,
} from "nostr-tools"
import {InMemoryStorageAdapter} from "../../StorageAdapter"
import {MockRelay} from "./mockRelay"

export interface MockConnectionController {
  goOffline(): void
  goOnline(): void
  isOnline(): boolean
}

type ManagedSubscription = {
  filter: Filter
  onEvent: (event: VerifiedEvent) => void
  unsubscribeFromRelay: (() => void) | null
  active: boolean
  removed: boolean
}

class SubscriptionController implements MockConnectionController {
  private relay: MockRelay
  private subscriptions: Set<ManagedSubscription> = new Set()
  private online = true

  constructor(relay: MockRelay) {
    this.relay = relay
  }

  subscribe(filter: Filter, onEvent: (event: VerifiedEvent) => void): () => void {
    const record: ManagedSubscription = {
      filter,
      onEvent,
      unsubscribeFromRelay: null,
      active: false,
      removed: false,
    }

    if (this.online) {
      record.unsubscribeFromRelay = this.relay.subscribe(filter, onEvent)
      record.active = true
    }

    this.subscriptions.add(record)

    return () => {
      if (record.removed) return
      record.removed = true
      if (record.active) {
        record.unsubscribeFromRelay?.()
        record.active = false
        record.unsubscribeFromRelay = null
      }
      this.subscriptions.delete(record)
    }
  }

  goOffline(): void {
    if (!this.online) return
    this.online = false
    for (const record of this.subscriptions) {
      if (record.active) {
        record.unsubscribeFromRelay?.()
        record.active = false
        record.unsubscribeFromRelay = null
      }
    }
  }

  goOnline(): void {
    if (this.online) return
    this.online = true
  }

  isOnline(): boolean {
    return this.online
  }
}

export const createMockSessionManager = async (
  deviceId: string,
  sharedMockRelay?: MockRelay,
  existingSecretKey?: Uint8Array,
  existingStorage?: InMemoryStorageAdapter
) => {
  const secretKey = existingSecretKey || generateSecretKey()
  const publicKey = getPublicKey(secretKey)

  const mockStorage = existingStorage || new InMemoryStorageAdapter()
  const storageSpy = {
    get: vi.spyOn(mockStorage, "get"),
    del: vi.spyOn(mockStorage, "del"),
    put: vi.spyOn(mockStorage, "put"),
    list: vi.spyOn(mockStorage, "list"),
  }

  const mockRelay = sharedMockRelay || new MockRelay()
  const connection = new SubscriptionController(mockRelay)

  const subscribe = vi
    .fn()
    .mockImplementation((filter: Filter, onEvent: (event: VerifiedEvent) => void) => {
      return connection.subscribe(filter, onEvent)
    })

  const publish = vi.fn().mockImplementation(async (event: UnsignedEvent) => {
    return await mockRelay.publish(event, secretKey)
  })

  const manager = new SessionManager(
    publicKey,
    secretKey,
    deviceId,
    subscribe,
    publish,
    mockStorage
  )

  await manager.init()

  const onEvent = vi.fn()
  manager.onEvent(onEvent)

  return {
    manager,
    subscribe,
    publish,
    onEvent,
    mockStorage,
    storageSpy,
    secretKey,
    publicKey,
    relay: mockRelay,
    connection,
  }
}
