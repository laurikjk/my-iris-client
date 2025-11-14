import type {NDKCacheAdapter} from "@/lib/ndk"
import type {NDKCacheAdapterDexieOptions} from "@/lib/ndk-cache"
import NDKCacheAdapterDexie from "@/lib/ndk-cache"

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
 * Create NDK cache adapter with SQLite WASM if supported, fallback to Dexie
 */
export async function createNDKCacheAdapter(
  options: NDKCacheAdapterDexieOptions
): Promise<NDKCacheAdapter> {
  // Check OPFS support
  const opfsSupported = await hasOPFSSupport()
  if (!opfsSupported) {
    console.log(
      "📦 NDK Cache: Using Dexie (OPFS not available)",
      "\n  - navigator.storage.getDirectory:",
      !!navigator.storage?.getDirectory
    )
    localStorage.setItem("ndk-cache-backend", "dexie")
    return new NDKCacheAdapterDexie(options)
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

    localStorage.setItem("ndk-cache-backend", "sqlite")
    return adapter as unknown as NDKCacheAdapter
  } catch (error) {
    console.warn(
      "⚠️ NDK Cache: SQLite WASM failed, falling back to Dexie",
      "\n  - Error:",
      error
    )
    localStorage.setItem("ndk-cache-backend", "dexie")
    return new NDKCacheAdapterDexie(options)
  }
}
