import type {NDKCacheAdapter, NDKEvent, NDKFilter, NDKRelay} from "@/lib/ndk"
import type {NDKCacheAdapterDexieOptions} from "@/lib/ndk-cache"
import NDKCacheAdapterDexie from "@/lib/ndk-cache"

/**
 * Cache hit statistics
 */
export const cacheStats = {
  cacheHits: 0, // Events loaded from cache
  relayDuplicates: 0, // Events from relay that were already in cache
  relayNew: 0, // Events from relay that were not in cache
  cachedEventIds: new Set<string>(), // Track which events came from cache

  reset() {
    this.cacheHits = 0
    this.relayDuplicates = 0
    this.relayNew = 0
    this.cachedEventIds.clear()
  },

  log() {
    const total = this.cacheHits + this.relayNew
    if (total === 0) return
    const cacheEffectiveness = ((this.cacheHits / total) * 100).toFixed(1)
    console.log(
      `📊 Cache Performance:\n` +
        `  - Loaded from cache: ${this.cacheHits} events\n` +
        `  - New from relays: ${this.relayNew} events\n` +
        `  - Relay duplicates (already cached): ${this.relayDuplicates} events\n` +
        `  - Cache effectiveness: ${cacheEffectiveness}% (served from cache before relays)`
    )
  },
}

/**
 * Detect OPFS support (Origin Private File System)
 * OPFS is available via navigator.storage.getDirectory()
 */
async function hasOPFSSupport(): Promise<boolean> {
  if (typeof window === "undefined") return false

  try {
    // Check for OPFS API (different from File System Access API)
    if (!navigator.storage?.getDirectory) return false

    // Try to access OPFS
    await navigator.storage.getDirectory()
    return true
  } catch {
    return false
  }
}

/**
 * Wrap adapter to track cache hits and relay duplicates
 */
function wrapAdapterWithStats(adapter: NDKCacheAdapter): NDKCacheAdapter {
  const originalQuery = adapter.query?.bind(adapter)
  const originalSetEvent = adapter.setEvent?.bind(adapter)

  // Track events loaded from cache
  if (originalQuery) {
    adapter.query = async function (subscription) {
      const events = await originalQuery(subscription)
      if (events && events.length > 0) {
        cacheStats.cacheHits += events.length
        // Track which events came from cache
        events.forEach((event) => {
          if (event.id) {
            cacheStats.cachedEventIds.add(event.id)
          }
        })
      }
      return events
    }
  }

  // Track events coming from relays (check if duplicate)
  if (originalSetEvent) {
    adapter.setEvent = async function (event: NDKEvent, filters: NDKFilter[], relay?: NDKRelay) {
      const eventId = event.id
      if (eventId) {
        if (cacheStats.cachedEventIds.has(eventId)) {
          // This event was already in cache - relay sent duplicate
          cacheStats.relayDuplicates++
        } else {
          // New event from relay
          cacheStats.relayNew++
          cacheStats.cachedEventIds.add(eventId)
        }
      }
      return originalSetEvent(event, filters, relay)
    }
  }

  return adapter
}

/**
 * Create NDK cache adapter with SQLite WASM if supported, fallback to Dexie
 */
export async function createNDKCacheAdapter(
  options: NDKCacheAdapterDexieOptions
): Promise<NDKCacheAdapter> {
  // Reset stats on init
  cacheStats.reset()

  // Log stats every 30 seconds
  setInterval(() => cacheStats.log(), 30000)

  // Check OPFS support
  const opfsSupported = await hasOPFSSupport()
  if (!opfsSupported) {
    console.log(
      "📦 NDK Cache: Using Dexie (OPFS not available)",
      "\n  - navigator.storage.getDirectory:",
      !!navigator.storage?.getDirectory
    )
    return wrapAdapterWithStats(new NDKCacheAdapterDexie(options))
  }

  try {
    console.log("🔄 NDK Cache: Attempting to load SQLite WASM...")

    // Lazy load SQLite WASM adapter (separate chunk)
    const SqliteModule = await import("@nostr-dev-kit/ndk-cache-sqlite-wasm")

    // Create sqlite adapter with WASM URL from public directory
    // Use separate DB name to avoid conflict with existing Dexie database
    const adapter = new SqliteModule.default({
      dbName: (options.dbName || "ndk") + "-sqlite",
      wasmUrl: "/sql-wasm.wasm",
    })

    // Initialize async
    await adapter.initializeAsync()

    console.log(
      "✅ NDK Cache: Using SQLite WASM with OPFS",
      "\n  - Database:",
      (options.dbName || "ndk") + "-sqlite",
      "\n  - WASM size: 644KB (one-time load)",
      "\n  - Storage: Origin Private File System"
    )

    return wrapAdapterWithStats(adapter as unknown as NDKCacheAdapter)
  } catch (error) {
    console.warn(
      "⚠️ NDK Cache: SQLite WASM failed, falling back to Dexie",
      "\n  - Error:",
      error
    )
    return wrapAdapterWithStats(new NDKCacheAdapterDexie(options))
  }
}
