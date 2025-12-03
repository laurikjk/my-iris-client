import {NDKUserProfile} from "@/lib/ndk"
import {getWorkerTransport} from "@/utils/ndk"

export type SearchResult = {
  name: string
  pubKey: string
  nip05?: string
}

// Profile events are now handled directly in relay-worker when kind 0 events arrive
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function handleProfile(pubKey: string, profile: NDKUserProfile) {}

export function search(
  query: string
): Promise<Array<{item: SearchResult; score?: number}>> {
  const transport = getWorkerTransport()
  if (!transport) {
    return Promise.resolve([])
  }
  return transport.search(query)
}
