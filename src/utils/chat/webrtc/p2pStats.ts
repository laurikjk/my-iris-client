import localforage from "localforage"

// Stats storage
const statsStore = localforage.createInstance({
  name: "iris",
  storeName: "webrtc-stats",
})

export interface P2PStats {
  eventsSent: number
  eventsReceived: number
  subscriptionsServed: number
  blobsSent: number
  blobsReceived: number
  blobBytesSent: number
  blobBytesReceived: number
  eventBytesSent: number
  eventBytesReceived: number
}

async function getStats(): Promise<P2PStats> {
  const stats = await statsStore.getItem<P2PStats>("p2p-stats")
  if (!stats) {
    return {
      eventsSent: 0,
      eventsReceived: 0,
      subscriptionsServed: 0,
      blobsSent: 0,
      blobsReceived: 0,
      blobBytesSent: 0,
      blobBytesReceived: 0,
      eventBytesSent: 0,
      eventBytesReceived: 0,
    }
  }
  // Ensure all fields exist (migration for existing stats)
  return {
    eventsSent: stats.eventsSent || 0,
    eventsReceived: stats.eventsReceived || 0,
    subscriptionsServed: stats.subscriptionsServed || 0,
    blobsSent: stats.blobsSent || 0,
    blobsReceived: stats.blobsReceived || 0,
    blobBytesSent: stats.blobBytesSent || 0,
    blobBytesReceived: stats.blobBytesReceived || 0,
    eventBytesSent: stats.eventBytesSent || 0,
    eventBytesReceived: stats.eventBytesReceived || 0,
  }
}

export async function incrementSent(bytes: number) {
  const stats = await getStats()
  stats.eventsSent++
  stats.eventBytesSent += bytes
  await statsStore.setItem("p2p-stats", stats)
}

export async function incrementReceived(bytes: number) {
  const stats = await getStats()
  stats.eventsReceived++
  stats.eventBytesReceived += bytes
  await statsStore.setItem("p2p-stats", stats)
}

export async function incrementSubscriptionsServed() {
  const stats = await getStats()
  stats.subscriptionsServed++
  await statsStore.setItem("p2p-stats", stats)
}

export async function incrementBlobSent(bytes: number) {
  const stats = await getStats()
  stats.blobsSent++
  stats.blobBytesSent += bytes
  await statsStore.setItem("p2p-stats", stats)
}

export async function incrementBlobReceived(bytes: number) {
  const stats = await getStats()
  stats.blobsReceived++
  stats.blobBytesReceived += bytes
  await statsStore.setItem("p2p-stats", stats)
}

export async function getP2PStats(): Promise<P2PStats> {
  return getStats()
}

export async function resetP2PStats() {
  await statsStore.setItem("p2p-stats", {
    eventsSent: 0,
    eventsReceived: 0,
    subscriptionsServed: 0,
    blobsSent: 0,
    blobsReceived: 0,
    blobBytesSent: 0,
    blobBytesReceived: 0,
    eventBytesSent: 0,
    eventBytesReceived: 0,
  })
}
