import {useState, useEffect} from "react"
import {ndk as getNdk} from "@/utils/ndk"
import {Link} from "@/navigation"

export function RelayStats() {
  const [relays, setRelays] = useState<Array<{url: string; connected: boolean}>>([])

  useEffect(() => {
    const updateStats = () => {
      const ndk = getNdk()
      const relayList = Array.from(ndk.pool.relays.entries())
        .map(([url, relay]) => ({
          url: url.replace(/^wss?:\/\//, "").replace(/\/$/, ""),
          connected: relay.connected || false,
        }))
        .sort((a, b) => {
          // Sort by connection status first (connected relays first)
          const connectedA = a.connected ? 1 : 0
          const connectedB = b.connected ? 1 : 0
          const statusDiff = connectedB - connectedA

          if (statusDiff !== 0) {
            return statusDiff
          }
          // Secondary sort by URL alphabetically
          return a.url.localeCompare(b.url)
        })
      setRelays(relayList)
    }

    updateStats()
    const interval = setInterval(updateStats, 2000)
    return () => clearInterval(interval)
  }, [])

  const connectedCount = relays.filter((r) => r.connected).length

  return (
    <div className="bg-base-200/50 rounded-lg p-3">
      <Link to="/settings/network" className="inline-block mb-2">
        <h3 className="font-semibold text-sm opacity-80 hover:opacity-100 cursor-pointer transition-opacity underline decoration-dotted underline-offset-2">
          Relays ({connectedCount}/{relays.length})
        </h3>
      </Link>
      <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
        {relays.map((relay) => (
          <Link
            key={relay.url}
            to={`/relay/${encodeURIComponent(relay.url)}`}
            className="flex items-center gap-2 text-xs hover:opacity-100 transition-opacity group py-0.5"
          >
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${relay.connected ? "bg-success" : "bg-error"}`}
            />
            <span
              className={`${relay.connected ? "opacity-80" : "opacity-40"} group-hover:underline`}
            >
              {relay.url}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
