/**
 * Rate limiter for WebRTC event forwarding
 * Limits events to N per second per peer
 */
export class RateLimiter {
  private timestamps = new Map<string, number[]>()
  private readonly limit: number
  private readonly window: number

  constructor(limit = 5, windowMs = 1000) {
    this.limit = limit
    this.window = windowMs
  }

  check(peerId: string): boolean {
    const now = Date.now()
    const peerTimestamps = this.timestamps.get(peerId) || []

    // Remove timestamps outside window
    const recent = peerTimestamps.filter((ts) => now - ts < this.window)

    if (recent.length >= this.limit) {
      return false // Rate limit exceeded
    }

    recent.push(now)
    this.timestamps.set(peerId, recent)
    return true
  }

  cleanup() {
    const now = Date.now()
    for (const [peerId, timestamps] of this.timestamps.entries()) {
      const recent = timestamps.filter((ts) => now - ts < this.window)
      if (recent.length === 0) {
        this.timestamps.delete(peerId)
      } else {
        this.timestamps.set(peerId, recent)
      }
    }
  }
}
