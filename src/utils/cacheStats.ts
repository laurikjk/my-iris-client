/**
 * Track cache effectiveness: how many events loaded from cache vs relays
 */
export const cacheStats = {
  cacheHits: 0, // Events loaded from cache before relays
  relayDuplicates: 0, // Events from relay that were already seen from cache
  relayNew: 0, // New events from relay
  seenEventIds: new Set<string>(), // Track which events we've seen

  trackCacheEvent(eventId: string) {
    this.cacheHits++
    this.seenEventIds.add(eventId)
  },

  trackRelayEvent(eventId: string) {
    if (this.seenEventIds.has(eventId)) {
      // Already had this from cache
      this.relayDuplicates++
    } else {
      // New event from relay
      this.relayNew++
      this.seenEventIds.add(eventId)
    }
  },

  reset() {
    this.cacheHits = 0
    this.relayDuplicates = 0
    this.relayNew = 0
    this.seenEventIds.clear()
  },

  log() {
    const total = this.cacheHits + this.relayNew
    if (total === 0) return

    const cacheEffectiveness = ((this.cacheHits / total) * 100).toFixed(1)
    const bandwidthSaved = (
      (this.relayDuplicates / (this.relayDuplicates + this.relayNew)) *
      100
    ).toFixed(1)

    console.log(
      `📊 Cache Performance:\n` +
        `  Cache served: ${this.cacheHits} events (${cacheEffectiveness}% of total)\n` +
        `  New from relays: ${this.relayNew} events\n` +
        `  Relay duplicates: ${this.relayDuplicates} events (${bandwidthSaved}% bandwidth wasted)\n` +
        `  Total unique: ${total} events`
    )
  },
}

// Log stats every 30 seconds
if (typeof window !== "undefined") {
  setInterval(() => cacheStats.log(), 30000)
}
