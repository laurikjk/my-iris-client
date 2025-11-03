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
}

async function getStats(): Promise<P2PStats> {
  const stats = await statsStore.getItem<P2PStats>("p2p-stats")
  if (!stats) {
    return {eventsSent: 0, eventsReceived: 0, subscriptionsServed: 0}
  }
  // Ensure all fields exist (migration for existing stats)
  return {
    eventsSent: stats.eventsSent || 0,
    eventsReceived: stats.eventsReceived || 0,
    subscriptionsServed: stats.subscriptionsServed || 0,
  }
}

export async function incrementSent() {
  const stats = await getStats()
  stats.eventsSent++
  await statsStore.setItem("p2p-stats", stats)
}

export async function incrementReceived() {
  const stats = await getStats()
  stats.eventsReceived++
  await statsStore.setItem("p2p-stats", stats)
}

export async function incrementSubscriptionsServed() {
  const stats = await getStats()
  stats.subscriptionsServed++
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
  })
}
