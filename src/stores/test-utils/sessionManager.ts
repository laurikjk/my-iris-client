import {generateSecretKey} from "nostr-tools"
import {vi} from "vitest"
import type {StorageAdapter} from "../StorageAdapter"

// In-memory storage adapter for testing
export class InMemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, any>()

  async get<T = any>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined
  }

  async put<T = any>(key: string, value: T): Promise<void> {
    this.store.set(key, value)
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = []
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        keys.push(key)
      }
    }
    return keys
  }

  clear() {
    this.store.clear()
  }
}

// Mock dependencies factory
export const createMockDependencies = () => {
  const storage = new InMemoryStorageAdapter()
  
  return {
    nostrSubscribe: vi.fn().mockReturnValue(() => {}),
    nostrPublish: vi.fn().mockResolvedValue({}),
    storage,
    ourIdentityKey: generateSecretKey(),
    deviceId: "test-device-123",
  }
}