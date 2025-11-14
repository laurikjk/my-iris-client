import Dexie from "dexie"
import throttle from "lodash/throttle"

interface PeerBandwidthStats {
  pubkey: string
  eventsSent: number
  eventsReceived: number
  blobsSent: number
  blobsReceived: number
  eventBytesSent: number
  eventBytesReceived: number
  blobBytesSent: number
  blobBytesReceived: number
  lastSeen: number
}

class PeerBandwidthDatabase extends Dexie {
  peerStats!: Dexie.Table<PeerBandwidthStats, string>

  constructor() {
    super("peer-bandwidth-stats")
    this.version(1).stores({
      peerStats: "pubkey, lastSeen",
    })
  }
}

const db = new PeerBandwidthDatabase()

// In-memory cache (write to IDB throttled)
const memCache = new Map<string, PeerBandwidthStats>()
const dirtyPeers = new Set<string>()

// Flush to IDB every 5 seconds
const flushToIDB = throttle(
  async () => {
    if (dirtyPeers.size === 0) return
    const toWrite = Array.from(dirtyPeers).map((pubkey) => memCache.get(pubkey)!)
    dirtyPeers.clear()
    await db.peerStats.bulkPut(toWrite)
  },
  5000,
  {leading: false, trailing: true}
)

// Load from IDB on init
db.peerStats.toArray().then((stats) => {
  stats.forEach((stat) => memCache.set(stat.pubkey, stat))
})

function updateMemCache(pubkey: string, updates: Partial<PeerBandwidthStats>) {
  const existing = memCache.get(pubkey) || {
    pubkey,
    eventsSent: 0,
    eventsReceived: 0,
    blobsSent: 0,
    blobsReceived: 0,
    eventBytesSent: 0,
    eventBytesReceived: 0,
    blobBytesSent: 0,
    blobBytesReceived: 0,
    lastSeen: Date.now(),
  }

  memCache.set(pubkey, {...existing, ...updates, lastSeen: Date.now()})
  dirtyPeers.add(pubkey)
  flushToIDB()
}

export function trackPeerEventSent(pubkey: string, bytes: number) {
  const existing = memCache.get(pubkey)
  updateMemCache(pubkey, {
    eventsSent: (existing?.eventsSent || 0) + 1,
    eventBytesSent: (existing?.eventBytesSent || 0) + bytes,
  })
}

export function trackPeerEventReceived(pubkey: string, bytes: number) {
  const existing = memCache.get(pubkey)
  updateMemCache(pubkey, {
    eventsReceived: (existing?.eventsReceived || 0) + 1,
    eventBytesReceived: (existing?.eventBytesReceived || 0) + bytes,
  })
}

export function trackPeerBlobSent(pubkey: string, bytes: number) {
  const existing = memCache.get(pubkey)
  updateMemCache(pubkey, {
    blobsSent: (existing?.blobsSent || 0) + 1,
    blobBytesSent: (existing?.blobBytesSent || 0) + bytes,
  })
}

export function trackPeerBlobReceived(pubkey: string, bytes: number) {
  const existing = memCache.get(pubkey)
  updateMemCache(pubkey, {
    blobsReceived: (existing?.blobsReceived || 0) + 1,
    blobBytesReceived: (existing?.blobBytesReceived || 0) + bytes,
  })
}

export function updatePeerLastSeen(pubkey: string) {
  updateMemCache(pubkey, {})
}

export async function getPeerStats(limit = 50): Promise<PeerBandwidthStats[]> {
  return db.peerStats.orderBy("lastSeen").reverse().limit(limit).toArray()
}

export async function clearPeerStats() {
  await db.peerStats.clear()
  memCache.clear()
  dirtyPeers.clear()
}
