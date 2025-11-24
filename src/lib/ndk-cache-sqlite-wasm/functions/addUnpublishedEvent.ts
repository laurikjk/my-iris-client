import type {NDKEvent} from "@/lib/ndk"
import type {NDKCacheAdapterSqliteWasm} from "../index"

/**
 * Adds an unpublished event to the SQLite WASM database.
 * Supports both worker and direct database modes.
 * @param event The event to add
 * @param relayUrls Array of relay URLs
 * @param lastTryAt Timestamp of last try
 */
export async function addUnpublishedEvent(
  this: NDKCacheAdapterSqliteWasm,
  event: NDKEvent,
  relayUrls: string[],
  lastTryAt: number = Date.now()
): Promise<void> {
  await this.ensureInitialized()

  // Add to unpublished_events table for retry logic
  const unpubStmt = `
        INSERT OR REPLACE INTO unpublished_events (
            id, event, relays, lastTryAt
        ) VALUES (?, ?, ?, ?)
    `

  if (this.useWorker) {
    await this.postWorkerMessage({
      type: "run",
      payload: {
        sql: unpubStmt,
        params: [
          event.id,
          event.serialize(true, true),
          JSON.stringify(relayUrls),
          lastTryAt,
        ],
      },
    })
    // Also add to main events table so queries can find it (optimistic local-first)
    await this.setEvent(event, [])
  } else {
    if (!this.db) throw new Error("Database not initialized")
    this.db.run(unpubStmt, [
      event.id,
      event.serialize(true, true),
      JSON.stringify(relayUrls),
      lastTryAt,
    ])
    // Also add to main events table so queries can find it (optimistic local-first)
    await this.setEvent(event, [])
  }
}
