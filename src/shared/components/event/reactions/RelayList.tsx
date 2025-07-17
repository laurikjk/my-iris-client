import {useState} from "react"
import type {NDKRelay} from "@nostr-dev-kit/ndk"

export default function RelayList({relays}: {relays: NDKRelay[]}) {
  const [showAll, setShowAll] = useState(false)
  const maxToShow = 5

  // Normalize relay URLs for deduplication and display
  const normalizeUrl = (url: string) => {
    let u = url.replace(/^wss:\/\//, "")
    if (u.endsWith("/")) u = u.slice(0, -1)
    return u
  }

  // Deduplicate relays by normalized URL
  const dedupedRelays = Array.from(
    new Map(relays.map((r) => [normalizeUrl(r.url), r])).values()
  )

  const relaysToShow = showAll ? dedupedRelays : dedupedRelays.slice(0, maxToShow)
  return (
    <div className="px-4 pb-2 pt-1 text-xs text-base-content/50 flex flex-col gap-1 items-start">
      {relaysToShow.length > 0 && <div>From relays:</div>}
      {relaysToShow.map((relay, i) => (
        <div key={relay.url + i} className="truncate max-w-full">
          {normalizeUrl(relay.url)}
        </div>
      ))}
      {dedupedRelays.length > maxToShow && (
        <button
          className="text-primary hover:underline mt-1 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            setShowAll((v) => !v)
          }}
        >
          {showAll ? "Show less" : `Show ${dedupedRelays.length - maxToShow} more`}
        </button>
      )}
    </div>
  )
}
